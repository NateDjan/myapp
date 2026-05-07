import { Platform } from "react-native";
import Constants from "expo-constants";

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
  student_login?: string | null;
};

function resolveApiBase(): string {
  const bundled = (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim();
  if (bundled) return bundled.replace(/\/$/, "");

  if (process.env.EXPO_PUBLIC_API_URL?.trim()) {
    return process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, "");
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  const hostStr = hostUri ? String(hostUri) : "";
  const tunnelLike =
    hostStr.includes("exp.direct") || hostStr.includes("exp.host") || hostStr.includes("anonymous");

  if (hostUri && !tunnelLike) {
    const host = hostStr.split(":")[0];
    return `http://${host}:4000`;
  }

  return "";
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const base = resolveApiBase().trim();
  if (!base) {
    throw new Error(
      "L'application n'a pas d'adresse de serveur valide. Contactez l'equipe (fichier config/publicApi.json)."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...options, headers });
  } catch {
    throw new Error("Pas de connexion au serveur. Verifie ton internet ou reessaie plus tard.");
  }

  const data = (await parseResponseBody(response)) as any;

  if (!response.ok) {
    const msg =
      typeof data === "string"
        ? data
        : data?.error
          ? typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error)
          : `Erreur HTTP ${response.status}`;
    throw new Error(msg);
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
    request<{ token: string; accessToken?: string; refreshToken: string; parent: { id: number; name: string } }>(
      "/api/parents/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  refreshParentToken: (payload: { refreshToken: string }) =>
    request<{ token: string; accessToken?: string; refreshToken: string }>("/api/parents/refresh", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logoutParent: (token: string) =>
    request<void>(
      "/api/parents/logout",
      {
        method: "POST",
      },
      token
    ),
  loginStudent: (payload: { login: string; password: string }) =>
    request<{ token: string; child: Child }>('/api/students/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getStudentProfile: (token: string) => request<Child>('/api/students/me', {}, token),
  createChild: (
    token: string,
    payload: {
      firstName: string;
      grade: string;
      age: number;
      strengths: string;
      weaknesses: string;
      studentLogin: string;
      studentPassword: string;
    }
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
