import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, query } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { calculateDepartureSavings, calculateMeetingSnapshot } from "./costEngine.js";
import { exchangeCodeForTokens, getAuthUrl, getGoogleProfile, listTodayMeetings } from "./googleCalendar.js";
import { ensureDemoData } from "./sampleData.js";

dotenv.config();

const app = express();
const PgSession = connectPgSimple(session);
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(express.json());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);
app.use(
  session({
    store: new PgSession({
      pool,
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    secret: process.env.SESSION_SECRET || "meet-saver-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

function centsToEuros(cents = 0) {
  return Math.round((Number(cents) / 100 + Number.EPSILON) * 100) / 100;
}

function eurosToCents(euros = 0) {
  return Math.max(0, Math.round(Number(euros) * 100));
}

function serializeRole(row) {
  return {
    id: row.id,
    name: row.name,
    hourly_rate: centsToEuros(row.hourly_rate_cents),
  };
}

function serializeParticipant(row) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role_id: row.role_id,
    role_name: row.role_name || null,
    hourly_rate: centsToEuros(row.effective_hourly_rate_cents ?? row.hourly_rate_cents ?? 0),
  };
}

function serializeMeeting(row) {
  return {
    id: row.id,
    google_event_id: row.google_event_id,
    title: row.title,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    budget: centsToEuros(row.budget_cents),
    status: row.status,
  };
}

async function getCurrentUserId(req) {
  if (req.session.userId) {
    return req.session.userId;
  }

  if (process.env.ENABLE_DEMO_DATA === "false") {
    return null;
  }

  const userId = await ensureDemoData();
  req.session.userId = userId;
  return userId;
}

async function requireUser(req, res, next) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Google authentication required." });
    }
    req.userId = userId;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function upsertParticipant(client, userId, attendee) {
  const displayName = attendee.name || attendee.display_name || attendee.email.split("@")[0];
  const email = attendee.email.toLowerCase();
  const {
    rows: [participant],
  } = await client.query(
    `insert into participants (user_id, email, display_name)
     values ($1, $2, $3)
     on conflict (user_id, email)
     do update set display_name = excluded.display_name, updated_at = now()
     returning id`,
    [userId, email, displayName],
  );
  return participant.id;
}

async function loadMeetingSnapshot(meetingId, userId) {
  const {
    rows: [meeting],
  } = await query(
    `select id, google_event_id, title, starts_at, ends_at, budget_cents, status
     from meetings
     where id = $1 and user_id = $2`,
    [meetingId, userId],
  );

  if (!meeting) {
    return null;
  }

  const participants = await query(
    `select
       mp.id as meeting_participant_id,
       p.id as participant_id,
       p.display_name as name,
       p.email,
       r.name as role_name,
       coalesce(p.hourly_rate_cents, r.hourly_rate_cents, 0) / 100.0 as hourly_rate,
       mp.joined_at,
       mp.left_at,
       mp.is_present
     from meeting_participants mp
     join participants p on p.id = mp.participant_id
     left join roles r on r.id = p.role_id
     where mp.meeting_id = $1
     order by p.display_name`,
    [meetingId],
  );

  const agenda = await query(
    `select
       ab.id,
       ab.title,
       ab.position,
       ab.planned_minutes,
       ab.completed_at,
       case when ab.completed_at is null then 'pending' else 'completed' end as status,
       coalesce(array_remove(array_agg(abp.participant_id), null), '{}') as required_participant_ids
     from agenda_blocks ab
     left join agenda_block_participants abp on abp.agenda_block_id = ab.id
     where ab.meeting_id = $1
     group by ab.id
     order by ab.position`,
    [meetingId],
  );

  const departures = await query(
    `select potential_savings_cents / 100.0 as savings_amount
     from departure_events
     where meeting_id = $1 and status = 'validated'`,
    [meetingId],
  );

  return {
    meeting: serializeMeeting(meeting),
    snapshot: calculateMeetingSnapshot(
      meeting,
      participants.rows,
      agenda.rows,
      departures.rows,
    ),
    agenda: agenda.rows,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "meet-saver" });
});

app.get("/api/auth/me", requireUser, async (req, res) => {
  const {
    rows: [user],
  } = await query(
    `select id, email, display_name, avatar_url, google_access_token is not null as google_connected
     from users
     where id = $1`,
    [req.userId],
  );
  res.json({ user });
});

app.get("/api/auth/google", (_req, res, next) => {
  try {
    res.json({ url: getAuthUrl(CLIENT_URL) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/google/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).send("Missing OAuth code.");
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await getGoogleProfile(tokens);
    const {
      rows: [user],
    } = await query(
      `insert into users (
         google_id, email, display_name, avatar_url, google_access_token, google_refresh_token, google_token_expiry
       )
       values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
       on conflict (email)
       do update set
         google_id = excluded.google_id,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         google_access_token = excluded.google_access_token,
         google_refresh_token = coalesce(excluded.google_refresh_token, users.google_refresh_token),
         google_token_expiry = excluded.google_token_expiry,
         updated_at = now()
       returning id`,
      [
        profile.googleId,
        profile.email,
        profile.displayName,
        profile.avatarUrl,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date || Date.now() + 3600 * 1000,
      ],
    );

    req.session.userId = user.id;
    return res.redirect(typeof state === "string" ? state : CLIENT_URL);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/calendar/sync", requireUser, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      rows: [user],
    } = await client.query(
      `select google_access_token, google_refresh_token, extract(epoch from google_token_expiry) * 1000 as expiry_date
       from users
       where id = $1`,
      [req.userId],
    );

    if (!user?.google_access_token) {
      return res.status(400).json({ error: "Connect Google Calendar before syncing." });
    }

    const events = await listTodayMeetings({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token,
      expiry_date: user.expiry_date,
    });

    await client.query("begin");
    const syncedMeetings = [];

    for (const event of events) {
      const {
        rows: [meeting],
      } = await client.query(
        `insert into meetings (user_id, google_event_id, title, starts_at, ends_at, budget_cents, status)
         values ($1, $2, $3, $4, $5, 0, 'scheduled')
         on conflict (user_id, google_event_id)
         do update set title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = now()
         returning id, google_event_id, title, starts_at, ends_at, budget_cents, status`,
        [req.userId, event.google_event_id, event.title, event.starts_at, event.ends_at],
      );

      for (const attendee of event.attendees) {
        const participantId = await upsertParticipant(client, req.userId, attendee);
        await client.query(
          `insert into meeting_participants (meeting_id, participant_id, joined_at)
           values ($1, $2, $3)
           on conflict (meeting_id, participant_id) do nothing`,
          [meeting.id, participantId, event.starts_at],
        );
      }
      syncedMeetings.push(serializeMeeting(meeting));
    }

    await client.query("commit");
    return res.json({ meetings: syncedMeetings, count: syncedMeetings.length });
  } catch (error) {
    await client.query("rollback");
    return next(error);
  } finally {
    client.release();
  }
});

app.get("/api/roles", requireUser, async (req, res) => {
  const { rows } = await query(
    `select id, name, hourly_rate_cents from roles where user_id = $1 order by name`,
    [req.userId],
  );
  res.json({ roles: rows.map(serializeRole) });
});

app.post("/api/roles", requireUser, async (req, res) => {
  const { name, hourly_rate } = req.body;
  const {
    rows: [role],
  } = await query(
    `insert into roles (user_id, name, hourly_rate_cents)
     values ($1, $2, $3)
     on conflict (user_id, name)
     do update set hourly_rate_cents = excluded.hourly_rate_cents, updated_at = now()
     returning id, name, hourly_rate_cents`,
    [req.userId, name, eurosToCents(hourly_rate)],
  );
  res.status(201).json({ role: serializeRole(role) });
});

app.get("/api/participants", requireUser, async (req, res) => {
  const { rows } = await query(
    `select
       p.id, p.email, p.display_name, p.role_id, p.hourly_rate_cents,
       r.name as role_name,
       coalesce(p.hourly_rate_cents, r.hourly_rate_cents, 0) as effective_hourly_rate_cents
     from participants p
     left join roles r on r.id = p.role_id
     where p.user_id = $1
     order by p.display_name`,
    [req.userId],
  );
  res.json({ participants: rows.map(serializeParticipant) });
});

app.patch("/api/participants/:id", requireUser, async (req, res) => {
  const { display_name, role_id, hourly_rate } = req.body;
  const {
    rows: [participant],
  } = await query(
    `update participants
     set
       display_name = coalesce($3, display_name),
       role_id = $4,
       hourly_rate_cents = $5,
       updated_at = now()
     where id = $1 and user_id = $2
     returning id, email, display_name, role_id, hourly_rate_cents`,
    [
      req.params.id,
      req.userId,
      display_name ?? null,
      role_id || null,
      hourly_rate === "" || hourly_rate === null || hourly_rate === undefined ? null : eurosToCents(hourly_rate),
    ],
  );
  if (!participant) {
    return res.status(404).json({ error: "Participant not found." });
  }
  return res.json({ participant: serializeParticipant(participant) });
});

app.get("/api/meetings", requireUser, async (req, res) => {
  const { rows } = await query(
    `select id, google_event_id, title, starts_at, ends_at, budget_cents, status
     from meetings
     where user_id = $1
     order by starts_at asc`,
    [req.userId],
  );
  res.json({ meetings: rows.map(serializeMeeting) });
});

app.post("/api/meetings/demo", requireUser, async (req, res, next) => {
  try {
    const userId = await ensureDemoData();
    req.session.userId = userId;
    const { rows } = await query(
      `select id, google_event_id, title, starts_at, ends_at, budget_cents, status
       from meetings
       where user_id = $1
       order by starts_at asc`,
      [userId],
    );
    res.json({ meetings: rows.map(serializeMeeting) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/meetings/:id", requireUser, async (req, res) => {
  const snapshot = await loadMeetingSnapshot(req.params.id, req.userId);
  if (!snapshot) {
    return res.status(404).json({ error: "Meeting not found." });
  }
  return res.json(snapshot);
});

app.get("/api/meetings/:id/costs", requireUser, async (req, res) => {
  const snapshot = await loadMeetingSnapshot(req.params.id, req.userId);
  if (!snapshot) {
    return res.status(404).json({ error: "Meeting not found." });
  }
  return res.json(snapshot.snapshot);
});

app.post("/api/meetings/:id/agenda", requireUser, async (req, res) => {
  const { title, planned_minutes, participant_ids = [] } = req.body;
  const {
    rows: [positionRow],
  } = await query(
    "select coalesce(max(position), 0) + 1 as next_position from agenda_blocks where meeting_id = $1",
    [req.params.id],
  );
  const {
    rows: [block],
  } = await query(
    `insert into agenda_blocks (meeting_id, title, position, planned_minutes)
     values ($1, $2, $3, $4)
     returning id, title, position, planned_minutes, completed_at`,
    [req.params.id, title, positionRow.next_position, Number(planned_minutes)],
  );

  for (const participantId of participant_ids) {
    await query(
      `insert into agenda_block_participants (agenda_block_id, participant_id)
       values ($1, $2)
       on conflict (agenda_block_id, participant_id) do nothing`,
      [block.id, participantId],
    );
  }

  res.status(201).json({ agenda_block: block });
});

app.patch("/api/agenda/:blockId", requireUser, async (req, res) => {
  const { completed } = req.body;
  const {
    rows: [block],
  } = await query(
    `update agenda_blocks
     set completed_at = case when $2::boolean then now() else null end, updated_at = now()
     where id = $1
     returning id, meeting_id, title, position, planned_minutes, completed_at`,
    [req.params.blockId, Boolean(completed)],
  );
  if (!block) {
    return res.status(404).json({ error: "Agenda block not found." });
  }

  const snapshot = await loadMeetingSnapshot(block.meeting_id, req.userId);
  return res.json({ agenda_block: block, suggestions: snapshot?.snapshot.suggestions || [] });
});

app.post("/api/meetings/:id/departures", requireUser, async (req, res) => {
  const { participant_id, agenda_block_id } = req.body;
  const snapshot = await loadMeetingSnapshot(req.params.id, req.userId);
  if (!snapshot) {
    return res.status(404).json({ error: "Meeting not found." });
  }

  const participant = snapshot.snapshot.participant_costs.find((item) => item.participant_id === participant_id);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found in meeting." });
  }

  const savings = calculateDepartureSavings(snapshot.meeting, participant);
  await query(
    `update meeting_participants
     set left_at = now(), is_present = false, updated_at = now()
     where meeting_id = $1 and participant_id = $2`,
    [req.params.id, participant_id],
  );

  const {
    rows: [event],
  } = await query(
    `insert into departure_events (
       meeting_id, participant_id, agenda_block_id, suggested_at, validated_at, potential_savings_cents, status
     )
     values ($1, $2, $3, now(), now(), $4, 'validated')
     returning id, potential_savings_cents, validated_at, status`,
    [req.params.id, participant_id, agenda_block_id || null, eurosToCents(savings)],
  );

  const updatedSnapshot = await loadMeetingSnapshot(req.params.id, req.userId);
  res.status(201).json({
    departure: {
      id: event.id,
      savings_amount: centsToEuros(event.potential_savings_cents),
      validated_at: event.validated_at,
      status: event.status,
    },
    snapshot: updatedSnapshot?.snapshot,
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: error.message || "Unexpected server error.",
  });
});

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Meet Saver API listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to start Meet Saver API:", error);
    process.exit(1);
  });
