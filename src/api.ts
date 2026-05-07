export type Child = {
  id: number;
  first_name: string;
  grade: string;
  age: number;
  strengths: string;
  weaknesses: string;
  points: number;
  reading_level: number;
  spelling_level: number;
  math_level: number;
  history_level: number;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ? JSON.stringify(data.error) : "API error");
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  registerParent: (payload: { name: string; email: string; password: string }) =>
    request<{ parentId: number }>("/api/parents/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  loginParent: (payload: { email: string; password: string }) =>
    request<{ token: string; accessToken: string; refreshToken: string; parent: { id: number; name: string } }>(
      "/api/parents/login",
      {
      method: "POST",
      body: JSON.stringify(payload),
      }
    ),
  refreshParentToken: (payload: { refreshToken: string }) =>
    request<{ token: string; accessToken: string; refreshToken: string }>("/api/parents/refresh", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createChild: (
    token: string,
    payload: { firstName: string; grade: string; age: number; strengths: string; weaknesses: string }
  ) =>
    request<{ childId: number }>(
      "/api/parents/children",
      { method: "POST", body: JSON.stringify(payload) },
      token
    ),
  getChildren: (token: string) => request<Child[]>("/api/parents/children", {}, token),
  evaluateChild: (token: string, childId: number) =>
    request<{ score: number; readingLevel: number; spellingLevel: number }>(
      `/api/evaluation/${childId}`,
      { method: "POST" },
      token
    ),
  getLesson: (token: string, childId: number, subject: string) =>
    request<{
      lesson: { prompt: string; expected: string };
      dictation: { prompt: string; expected: string } | null;
      review: { id: number; phrase: string } | null;
    }>(`/api/lesson/${childId}?subject=${encodeURIComponent(subject)}`, {}, token),
  submitDictation: (token: string, childId: number, payload: { expected: string; answer: string }) =>
    request<{ score: number; points: number; feedback: string }>(
      `/api/session/${childId}/dictation`,
      { method: "POST", body: JSON.stringify(payload) },
      token
    ),
  completeReview: (token: string, reviewId: number, success: boolean) =>
    request<{ status: string; nextInterval?: number }>(
      `/api/review/${reviewId}/complete`,
      { method: "POST", body: JSON.stringify({ success }) },
      token
    ),
  createHomework: (
    token: string,
    childId: number,
    payload: { subject: string; title: string; details: string; dueDate: string; source?: "manual" | "pronote-import" }
  ) =>
    request<{ homeworkId: number }>(
      `/api/homework/${childId}`,
      { method: "POST", body: JSON.stringify(payload) },
      token
    ),
  getHomework: (token: string, childId: number) => request<any[]>(`/api/homework/${childId}`, {}, token),
  getDashboard: (token: string) =>
    request<{ totals: { points: number; children: number }; progress: any[] }>("/api/parents/dashboard", {}, token),
  getSecurity: (token: string) =>
    request<{ activeAccessSessions: number; activeRefreshSessions: number; recentEvents: any[] }>(
      "/api/parents/security",
      {},
      token
    ),
  getCurriculum: () =>
    request<{ metadata: { sources: string[]; notes: string }; grades: any[] }>("/api/curriculum"),
  getRecommendations: (token: string, childId: number) =>
    request<{ grade: string; cycle: string; recommendations: any[]; sources: string[] }>(
      `/api/recommendations/${childId}`,
      {},
      token
    ),
};
