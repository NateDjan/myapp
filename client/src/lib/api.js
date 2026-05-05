const API_BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  me: () => request("/api/auth/me"),
  getMe: () => request("/api/auth/me"),
  googleAuth: () => request("/api/auth/google"),
  getGoogleAuthUrl: () => request("/api/auth/google"),
  syncCalendar: () => request("/api/calendar/sync", { method: "POST" }),
  roles: () => request("/api/roles"),
  getRoles: () => request("/api/roles"),
  saveRole: (role) => request("/api/roles", { method: "POST", body: JSON.stringify(role) }),
  upsertRole: (role) => request("/api/roles", { method: "POST", body: JSON.stringify(role) }),
  participants: () => request("/api/participants"),
  getParticipants: () => request("/api/participants"),
  updateParticipant: (id, payload) =>
    request(`/api/participants/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  meetings: () => request("/api/meetings"),
  getMeetings: () => request("/api/meetings"),
  meeting: (id) => request(`/api/meetings/${id}`),
  getMeeting: (id) => request(`/api/meetings/${id}`),
  costs: (id) => request(`/api/meetings/${id}/costs`),
  getCosts: (id) => request(`/api/meetings/${id}/costs`),
  createAgendaBlock: (meetingId, payload) =>
    request(`/api/meetings/${meetingId}/agenda`, { method: "POST", body: JSON.stringify(payload) }),
  completeAgendaBlock: (blockId, completed) =>
    request(`/api/agenda/${blockId}`, { method: "PATCH", body: JSON.stringify({ completed }) }),
  validateDeparture: (meetingId, payload) =>
    request(`/api/meetings/${meetingId}/departures`, { method: "POST", body: JSON.stringify(payload) }),
};
