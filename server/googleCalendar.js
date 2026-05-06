import { google } from "googleapis";

export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state = "/") {
  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: CALENDAR_SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    throw new Error("Google OAuth is not configured.");
  }

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function createCalendarClient(tokens) {
  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    throw new Error("Google OAuth is not configured.");
  }

  oauth2Client.setCredentials(tokens);
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function getGoogleProfile(tokens) {
  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    throw new Error("Google OAuth is not configured.");
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return {
    googleId: data.id,
    email: data.email,
    displayName: data.name || data.email,
    avatarUrl: data.picture,
  };
}

function getTodayWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

export async function listTodayMeetings(tokens) {
  const calendar = createCalendarClient(tokens);
  const { timeMin, timeMax } = getTodayWindow();

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (response.data.items || [])
    .filter((event) => event.start?.dateTime && event.end?.dateTime)
    .map((event) => ({
      google_event_id: event.id,
      title: event.summary || "Reunion sans titre",
      starts_at: event.start.dateTime,
      ends_at: event.end.dateTime,
      attendees: (event.attendees || [])
        .filter((attendee) => attendee.email)
        .map((attendee) => ({
          email: attendee.email,
          display_name: attendee.displayName || attendee.email.split("@")[0],
          response_status: attendee.responseStatus || "needsAction",
          organizer: Boolean(attendee.organizer),
        })),
    }));
}
