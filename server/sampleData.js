import { pool } from "./db/pool.js";

export async function ensureDemoData() {
  const { rows } = await pool.query("select id from users limit 1");
  if (rows.length > 0) {
    return rows[0].id;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const {
      rows: [user],
    } = await client.query(
      `insert into users (google_id, email, display_name)
       values ($1, $2, $3)
       returning id`,
      ["demo-user", "demo@meet-saver.local", "Meet Saver Demo"]
    );

    const roles = [
      ["Senior", 120],
      ["Junior", 60],
      ["Product", 95],
      ["Design", 80],
    ];

    const roleIds = {};
    for (const [name, rate] of roles) {
      const {
        rows: [role],
      } = await client.query(
        `insert into roles (user_id, name, hourly_rate_cents)
         values ($1, $2, $3)
         returning id, name`,
        [user.id, name, Math.round(rate * 100)]
      );
      roleIds[name] = role.id;
    }

    const participants = [
      ["Amina Diallo", "amina@example.com", "Senior", 120],
      ["Lucas Bernard", "lucas@example.com", "Product", 95],
      ["Maya Chen", "maya@example.com", "Design", 80],
      ["Noah Martin", "noah@example.com", "Junior", 60],
    ];

    const participantIds = {};
    for (const [name, email, roleName, rate] of participants) {
      const {
        rows: [participant],
      } = await client.query(
        `insert into participants (user_id, role_id, display_name, email, hourly_rate_cents)
         values ($1, $2, $3, $4, $5)
         returning id, display_name`,
        [user.id, roleIds[roleName], name, email, Math.round(rate * 100)]
      );
      participantIds[name] = participant.id;
    }

    const now = new Date();
    const startedAt = new Date(now.getTime() - 12 * 60 * 1000);
    const endsAt = new Date(now.getTime() + 48 * 60 * 1000);
    const {
      rows: [meeting],
    } = await client.query(
      `insert into meetings (user_id, title, google_event_id, starts_at, ends_at, budget_cents, status)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [user.id, "Roadmap Q3 - arbitrage budget", "demo-roadmap-q3", startedAt, endsAt, 42000, "live"]
    );

    for (const participantId of Object.values(participantIds)) {
      await client.query(
        `insert into meeting_participants (meeting_id, participant_id, joined_at, is_present)
         values ($1, $2, $3, true)`,
        [meeting.id, participantId, startedAt]
      );
    }

    const blocks = [
      {
        title: "Strategie",
        startsAt: startedAt,
        endsAt: new Date(startedAt.getTime() + 20 * 60 * 1000),
        required: ["Amina Diallo", "Lucas Bernard", "Maya Chen"],
        completed: true,
      },
      {
        title: "Execution",
        startsAt: new Date(startedAt.getTime() + 20 * 60 * 1000),
        endsAt: new Date(startedAt.getTime() + 45 * 60 * 1000),
        required: ["Amina Diallo", "Lucas Bernard", "Noah Martin"],
        completed: false,
      },
      {
        title: "Risques et decisions",
        startsAt: new Date(startedAt.getTime() + 45 * 60 * 1000),
        endsAt: endsAt,
        required: ["Amina Diallo", "Lucas Bernard"],
        completed: false,
      },
    ];

    for (const [index, block] of blocks.entries()) {
      const {
        rows: [agendaBlock],
      } = await client.query(
        `insert into agenda_blocks (meeting_id, title, position, planned_minutes, completed_at)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [meeting.id, block.title, index + 1, Math.max(1, Math.round((block.endsAt - block.startsAt) / 60000)), block.completed ? now : null]
      );

      for (const name of block.required) {
        await client.query(
          `insert into agenda_block_participants (agenda_block_id, participant_id)
           values ($1, $2)`,
          [agendaBlock.id, participantIds[name]]
        );
      }
    }

    await client.query("commit");
    return user.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
