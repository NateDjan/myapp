import { Platform } from "react-native";
import Constants from "expo-constants";

export type SubjectLevelState = { tier: number; streak: number };
export type SubjectTierDisplay = { tier: number; label: string; streak: number };
export type EvaluationRecord = { done?: boolean; score?: number; at?: string };

export type InterestTheme = {
  categoryId: string;
  favoriteId: string;
  categoryLabel: string;
  favoriteLabel: string;
  blurb?: string;
};

export type InterestOption = { id: string; label: string; blurb?: string };

export type InterestCategory = { id: string; label: string; options: InterestOption[] };

export type InterestCatalogPayload = {
  version?: string;
  meta?: { note?: string };
  categories: InterestCategory[];
};

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
  subjectLevels?: Record<string, SubjectLevelState>;
  subjectTiersDisplay?: Record<string, SubjectTierDisplay>;
  evaluationBySubject?: Record<string, EvaluationRecord>;
  optionalSubjectsEnabled?: string[];
  screen_time_earned_min?: number;
  avatar_id?: string;
  xp_total?: number;
  streak_days?: number;
  badges?: string[];
  interestTheme?: InterestTheme | null;
};

export type SubjectsMeta = {
  grade: string;
  coreSubjects: string[];
  optionalPool: string[];
  optionalEnabled: string[];
  activeSubjects: string[];
  evaluationBySubject: Record<string, EvaluationRecord>;
  subjectLevels: Record<string, SubjectLevelState>;
};

export type ParentSettings = {
  rewardMinutesPerSuccess: number;
  notifyOnUnlock: boolean;
};

export type ParentNotification = {
  id: number;
  child_id: number;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
  is_read: boolean;
};

export type GamificationState = {
  avatars: string[];
  avatarId: string;
  xpTotal: number;
  streakDays: number;
  badges: string[];
  strongestSubject: string;
  weakestSubject: string;
  quests: Array<{ id: string; title: string; completed: boolean }>;
};

/** Sans timeout, fetch peut rester bloque tres longtemps (Fly / Wi‑Fi / Expo Go). */
const FETCH_TIMEOUT_MS = 18_000;

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

/** Meme resolution que les appels HTTP (pour affichage / diagnostics). */
export function getResolvedApiBase(): string {
  return resolveApiBase().trim();
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "";
    if (name === "AbortError") {
      throw new Error(
        `Le serveur met trop longtemps a repondre (>${FETCH_TIMEOUT_MS / 1000}s). Verifie l'URL dans config/publicApi.json ou ton reseau.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
    response = await fetchWithTimeout(`${base}${path}`, { ...options, headers });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("trop longtemps")) throw e;
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
  registerParent: (payload: { name?: string; firstName?: string; lastName?: string; email: string; password: string }) =>
    request<{ parentId: number }>("/api/parents/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  loginParent: (payload: { email: string; password: string }) =>
    request<{ token: string; accessToken?: string; refreshToken: string; parent: { id: number; name: string; firstName?: string; lastName?: string } }>(
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
  getSubjectsMeta: (token: string, childId: number) =>
    request<SubjectsMeta>(`/api/children/${childId}/subjects-meta`, {}, token),
  patchOptionalSubjects: (token: string, childId: number, subjects: string[]) =>
    request<{ optionalSubjectsEnabled: string[] }>(`/api/parents/children/${childId}/optional-subjects`, {
      method: "PATCH",
      body: JSON.stringify({ subjects }),
    }, token),
  getGamification: (token: string, childId: number) => request<GamificationState>(`/api/gamification/${childId}`, {}, token),
  patchAvatar: (token: string, childId: number, avatarId: string) =>
    request<{ ok: boolean; avatarId: string }>(`/api/children/${childId}/avatar`, {
      method: "PATCH",
      body: JSON.stringify({ avatarId }),
    }, token),
  startEvaluation: (token: string, childId: number, subject: string) =>
    request<{ sessionId: number; total: number; subject: string }>(
      `/api/evaluation/${childId}/start`,
      { method: "POST", body: JSON.stringify({ subject }) },
      token
    ),
  getEvaluationQuestion: (token: string, sessionId: number) =>
    request<{
      sessionId: number;
      index: number;
      total: number;
      subject: string;
      exerciseType: string;
      prompt: string;
      readAloudText: string;
      finished?: boolean;
      correct?: number;
    }>(`/api/evaluation/session/${sessionId}/question`, {}, token),
  answerEvaluationQuestion: (token: string, sessionId: number, answer: string) =>
    request<{
      finished: boolean;
      isCorrect?: boolean;
      score?: number;
      nextIndex?: number;
      total?: number;
      finalScore?: number;
      passed?: boolean;
      completed?: boolean;
      tierLabel?: string;
      unlockedMinutes?: number;
      xpGain?: number;
      streakDays?: number;
      badges?: string[];
    }>(`/api/evaluation/session/${sessionId}/answer`, { method: "POST", body: JSON.stringify({ answer }) }, token),
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
  submitDictation: (
    token: string,
    childId: number,
    payload: { expected: string; answer: string; subject?: string }
  ) =>
    request<{ score: number; points: number; feedback: string; unlockedMinutes?: number; xpGain?: number; streakDays?: number; badges?: string[] }>(
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
  getParentSettings: (token: string) => request<ParentSettings>("/api/parents/settings", {}, token),
  patchParentSettings: (token: string, payload: ParentSettings) =>
    request<{ ok: boolean }>("/api/parents/settings", { method: "PATCH", body: JSON.stringify(payload) }, token),
  getParentNotifications: (token: string) => request<ParentNotification[]>("/api/parents/notifications", {}, token),
  getCurriculum: () =>
    request<{ metadata: { sources: string[]; notes: string }; grades: any[] }>("/api/curriculum"),
  getRecommendations: (token: string, childId: number) =>
    request<{ grade: string; cycle: string; recommendations: any[]; sources: string[] }>(
      `/api/recommendations/${childId}`,
      {},
      token
    ),
  getOnlinePrograms: (token: string, childId: number, subject?: string) =>
    request<{ grade: string; links: Array<{ subject: string; title: string; url: string }> }>(
      `/api/programs/${childId}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`,
      {},
      token
    ),
  getInterestCatalog: () => request<InterestCatalogPayload>("/api/interests/catalog"),
  patchChildInterests: (
    token: string,
    childId: number,
    payload: { categoryId: string; favoriteId: string } | { clear: true }
  ) =>
    request<{ ok: boolean; interestTheme: InterestTheme | null; child: Child }>(
      `/api/children/${childId}/interests`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),
};
