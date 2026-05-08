import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  api,
  getResolvedApiBase,
  type Child,
  type GamificationState,
  type ParentNotification,
  type ParentSettings,
  type SubjectsMeta,
} from "./src/api";
import { T, warmStyles } from "./src/theme";

type SessionStep = "lecture" | "dictee" | "correction" | "revision" | "reward";
type AppRole = "landing" | "auth" | "studentAuth" | "setup" | "parent" | "student";
type StudentTab = "home" | "eval" | "learn";

const SESSION_STORAGE_KEY = "educoach.session.v1";
const STUDENT_STORAGE_KEY = "educoach.student.v1";

const FR_GRADES = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6e",
  "5e",
  "4e",
  "3e",
  "2nde",
  "1ere",
  "Terminale",
] as const;

type FrenchGrade = (typeof FR_GRADES)[number];

type NewChildDraft = {
  firstName: string;
  grade: FrenchGrade;
  age: string;
  strengths: string;
  weaknesses: string;
  studentLogin: string;
  studentPassword: string;
};

const EMPTY_CHILD_DRAFT: NewChildDraft = {
  firstName: "",
  grade: FR_GRADES[0],
  age: "",
  strengths: "",
  weaknesses: "",
  studentLogin: "",
  studentPassword: "",
};

export default function App() {
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionKind, setSessionKind] = useState<"parent" | "student">("parent");
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kidLoginId, setKidLoginId] = useState("");
  const [kidPassword, setKidPassword] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [role, setRole] = useState<AppRole>("landing");
  const [subject, setSubject] = useState("Francais");
  const [gradePickerOpen, setGradePickerOpen] = useState(false);
  const [studentTab, setStudentTab] = useState<StudentTab>("home");
  const [subjectsMeta, setSubjectsMeta] = useState<SubjectsMeta | null>(null);
  const [parentOptionalDraft, setParentOptionalDraft] = useState<string[]>([]);
  const [evalItem, setEvalItem] = useState<{
    sessionId: number;
    index: number;
    total: number;
    exerciseType: string;
    prompt: string;
    readAloudText: string;
    subject: string;
  } | null>(null);
  const [evalAnswer, setEvalAnswer] = useState("");
  const [evalBusy, setEvalBusy] = useState(false);
  /** Affichee apres chaque reponse d'eval jusqu'a ce que l'eleve appuie sur Continuer. */
  const [evalCorrection, setEvalCorrection] = useState<string | null>(null);

  const [newChild, setNewChild] = useState<NewChildDraft>(EMPTY_CHILD_DRAFT);

  const [apiMessage, setApiMessage] = useState("Verification du serveur...");
  const [step, setStep] = useState<SessionStep>("lecture");
  const [lessonPrompt, setLessonPrompt] = useState("");
  const [dictationPrompt, setDictationPrompt] = useState("");
  const [dictationExpected, setDictationExpected] = useState("");
  const [dictationInput, setDictationInput] = useState("");
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);
  const [reviewPhrase, setReviewPhrase] = useState("");
  const [sessionFeedback, setSessionFeedback] = useState("");
  const [dashboard, setDashboard] = useState<any[]>([]);
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [parentSettings, setParentSettings] = useState<ParentSettings>({ rewardMinutesPerSuccess: 5, notifyOnUnlock: true });
  const [parentNotifications, setParentNotifications] = useState<ParentNotification[]>([]);
  const [onlinePrograms, setOnlinePrograms] = useState<Array<{ subject: string; title: string; url: string }>>([]);
  const [gamification, setGamification] = useState<GamificationState | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [curriculumSources, setCurriculumSources] = useState<string[]>([]);
  const [curriculumNote, setCurriculumNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  );

  useEffect(() => {
    let cancelled = false;

    const hydrateParentSession = async () => {
      try {
        const saved = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as {
          token: string;
          refreshToken?: string;
          parentName?: string;
          parentFirstName?: string;
          parentLastName?: string;
        };
        let activeToken = parsed.token;
        let activeRefresh = parsed.refreshToken || "";
        let kids: Child[] | null = null;
        try {
          kids = await api.getChildren(activeToken);
        } catch {
          if (activeRefresh) {
            const refreshed = await api.refreshParentToken({ refreshToken: activeRefresh });
            activeToken = refreshed.token;
            activeRefresh = refreshed.refreshToken;
            kids = await api.getChildren(activeToken);
          }
        }

        if (kids && !cancelled) {
          setToken(activeToken);
          setRefreshToken(activeRefresh);
          setParentName(parsed.parentName || "");
          setParentFirstName(parsed.parentFirstName || "");
          setParentLastName(parsed.parentLastName || "");
          setChildren(kids);
          if (kids.length > 0) setSelectedChildId(kids[0].id);
          setSessionKind("parent");
          setRole("setup");
          await AsyncStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              token: activeToken,
              refreshToken: activeRefresh,
              parentName: parsed.parentName || "",
              parentFirstName: parsed.parentFirstName || "",
              parentLastName: parsed.parentLastName || "",
            })
          );
        }
      } catch {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      }
    };

    const tryHydrateStudent = async () => {
      try {
        const saved = await AsyncStorage.getItem(STUDENT_STORAGE_KEY);
        if (!saved) return false;
        const parsed = JSON.parse(saved) as { token: string };
        const profile = await api.getStudentProfile(parsed.token);
        if (!cancelled) {
          setToken(parsed.token);
          setRefreshToken("");
          setSessionKind("student");
          setChildren([profile]);
          setSelectedChildId(profile.id);
          setRole("student");
        }
        return true;
      } catch {
        await AsyncStorage.removeItem(STUDENT_STORAGE_KEY);
        return false;
      }
    };

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setSessionLoading(false);
    }, 22000);

    const bootstrap = async () => {
      const base = getResolvedApiBase();
      if (!base) {
        clearTimeout(safetyTimer);
        if (!cancelled) {
          setApiMessage(
            "URL du serveur manquante : ajoute apiUrl dans config/publicApi.json puis relance Expo avec npx expo start -c."
          );
          setSessionLoading(false);
        }
        return;
      }

      try {
        const [healthResult, curriculumResult] = await Promise.allSettled([api.health(), api.getCurriculum()]);

        if (!cancelled) {
          if (healthResult.status === "fulfilled") {
            setApiMessage("Serveur disponible");
          } else {
            setApiMessage("Serveur indisponible ou trop lent — tu peux quand meme essayer de te connecter.");
          }

          if (curriculumResult.status === "fulfilled") {
            const data = curriculumResult.value;
            setCurriculumSources(Array.isArray(data.metadata?.sources) ? data.metadata.sources : []);
            setCurriculumNote(typeof data.metadata?.notes === "string" ? data.metadata.notes : "");
          }
        }
      } catch {
        if (!cancelled) setApiMessage("Serveur indisponible pour le moment");
      }

      clearTimeout(safetyTimer);
      if (!cancelled) setSessionLoading(false);

      try {
        const hasStudent = await tryHydrateStudent();
        if (!hasStudent) await hydrateParentSession();
      } catch {
        // session invalide ou reseau : ignore
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  const runAuth = async () => {
    setErrorMessage("");
    if (!email.trim()) {
      Alert.alert("Email manquant", "Saisis ton email.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Mot de passe trop court", "Minimum 8 caracteres.");
      return;
    }
    if (authMode === "register" && (!parentFirstName.trim() || !parentLastName.trim())) {
      Alert.alert("Infos parent", "Saisis le prenom et le nom du parent.");
      return;
    }
    setAuthBusy(true);
    try {
      await AsyncStorage.removeItem(STUDENT_STORAGE_KEY);
      if (authMode === "register") {
        await api.registerParent({
          firstName: parentFirstName.trim(),
          lastName: parentLastName.trim(),
          name: `${parentFirstName.trim()} ${parentLastName.trim()}`.trim(),
          email: email.trim(),
          password,
        });
      }
      const logged = await api.loginParent({ email: email.trim(), password });
      const access = logged.token || logged.accessToken || "";
      const rt = logged.refreshToken || "";
      setToken(access);
      setRefreshToken(rt);
      setParentName(logged.parent.name);
      setParentFirstName(logged.parent.firstName || parentFirstName.trim());
      setParentLastName(logged.parent.lastName || parentLastName.trim());
      setSessionKind("parent");
      setRole("setup");
      const kids = await api.getChildren(access);
      setChildren(kids);
      if (kids.length > 0) setSelectedChildId(kids[0].id);
      await AsyncStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          token: access,
          refreshToken: rt,
          parentName: logged.parent.name,
          parentFirstName: logged.parent.firstName || parentFirstName.trim(),
          parentLastName: logged.parent.lastName || parentLastName.trim(),
        })
      );
    } catch (error) {
      const msg = String(error);
      setErrorMessage(msg);
      Alert.alert("Connexion impossible", msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutStudent = async () => {
    await AsyncStorage.removeItem(STUDENT_STORAGE_KEY);
    setToken("");
    setRefreshToken("");
    setChildren([]);
    setSelectedChildId(null);
    setSessionKind("parent");
    setRole("landing");
  };

  const logout = async () => {
    try {
      if (token && sessionKind === "parent") await api.logoutParent(token);
    } catch {
      // ignore logout API errors and clear local session anyway
    }
    await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, STUDENT_STORAGE_KEY]);
    setToken("");
    setRefreshToken("");
    setChildren([]);
    setSelectedChildId(null);
    setSessionKind("parent");
    setRole("landing");
  };

  const runKidAuth = async () => {
    setErrorMessage("");
    const loginNorm = kidLoginId.trim().toLowerCase();
    if (!loginNorm) {
      Alert.alert("Identifiant manquant", "Demande a tes parents ton identifiant.");
      return;
    }
    if (kidPassword.length < 6) {
      Alert.alert("Mot de passe trop court", "Minimum 6 caracteres.");
      return;
    }
    setAuthBusy(true);
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      const result = await api.loginStudent({ login: loginNorm, password: kidPassword });
      await AsyncStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify({ token: result.token }));
      setKidPassword("");
      setToken(result.token);
      setRefreshToken("");
      setSessionKind("student");
      setChildren([result.child]);
      setSelectedChildId(result.child.id);
      setRole("student");
    } catch (error) {
      const msg = String(error);
      setErrorMessage(msg);
      Alert.alert("Connexion impossible", msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const reloadChildren = async () => {
    if (!token) return;
    const kids = await api.getChildren(token);
    setChildren(kids);
    if (!selectedChildId && kids.length > 0) setSelectedChildId(kids[0].id);
  };

  const loadSubjectsMeta = async () => {
    if (!token || !selectedChildId) return;
    try {
      const m = await api.getSubjectsMeta(token, selectedChildId);
      setSubjectsMeta(m);
      setParentOptionalDraft(m.optionalEnabled || []);
    } catch {
      setSubjectsMeta(null);
    }
  };

  useEffect(() => {
    loadSubjectsMeta();
  }, [selectedChildId, token]);

  const saveParentOptional = async () => {
    if (!token || !selectedChildId) return;
    setErrorMessage("");
    try {
      await api.patchOptionalSubjects(token, selectedChildId, parentOptionalDraft);
      await loadSubjectsMeta();
      await reloadChildren();
      Alert.alert("OK", "Les matieres optionnelles sont enregistrees.");
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  /** Voix francaise plus lisible : debit adapte iOS / Android / Web. */
  const speakFrench = (text: string) => {
    if (!text?.trim()) return;
    Speech.stop();
    const t = text.trim().replace(/\s+/g, " ");
    const rate =
      Platform.OS === "ios" ? 0.44 : Platform.OS === "android" ? 0.88 : Platform.OS === "web" ? 0.95 : 0.9;
    Speech.speak(t, {
      language: "fr-FR",
      pitch: 1.0,
      rate,
      volume: 1,
    });
  };

  const speakDicteePhrase = (prompt: string, expected: string) => {
    const p = String(prompt || "");
    if (/^Ecris\s*:/i.test(p)) speakFrench(String(expected || "").trim());
    else speakFrench(String(expected || prompt || "").trim());
  };

  const activeSubjectsList = useMemo(() => {
    if (subjectsMeta?.activeSubjects?.length) return subjectsMeta.activeSubjects;
    return ["Francais", "Maths", "Histoire"];
  }, [subjectsMeta]);

  const startEvalSubject = async (sub: string) => {
    if (!token || !selectedChild) return;
    setEvalBusy(true);
    setErrorMessage("");
    setEvalCorrection(null);
    try {
      const started = await api.startEvaluation(token, selectedChild.id, sub);
      const q = await api.getEvaluationQuestion(token, started.sessionId);
      setEvalItem({
        sessionId: started.sessionId,
        index: q.index,
        total: q.total,
        exerciseType: q.exerciseType,
        prompt: q.prompt,
        readAloudText: q.readAloudText,
        subject: q.subject,
      });
      setEvalAnswer("");
      const autoSpeak =
        !!q.readAloudText &&
        (q.exerciseType !== "french-reading" || q.readAloudText.length <= 280);
      if (autoSpeak) setTimeout(() => speakFrench(q.readAloudText), 400);
    } catch (error) {
      Alert.alert("Impossible", String(error));
    } finally {
      setEvalBusy(false);
    }
  };

  const advanceEvalAfterCorrection = async () => {
    if (!token || !evalItem) return;
    setEvalBusy(true);
    setEvalCorrection(null);
    try {
      const q = await api.getEvaluationQuestion(token, evalItem.sessionId);
      setEvalItem({
        sessionId: evalItem.sessionId,
        index: q.index,
        total: q.total,
        exerciseType: q.exerciseType,
        prompt: q.prompt,
        readAloudText: q.readAloudText,
        subject: q.subject,
      });
      setEvalAnswer("");
      const autoSpeak =
        !!q.readAloudText &&
        (q.exerciseType !== "french-reading" || q.readAloudText.length <= 280);
      if (autoSpeak) setTimeout(() => speakFrench(q.readAloudText), 350);
    } catch (error) {
      Alert.alert("Erreur", String(error));
    } finally {
      setEvalBusy(false);
    }
  };

  const submitEvalSession = async () => {
    if (!token || !selectedChild || !evalItem || evalCorrection !== null) return;
    setEvalBusy(true);
    try {
      const result = await api.answerEvaluationQuestion(token, evalItem.sessionId, evalAnswer);
      if (!result.finished) {
        setEvalCorrection(result.correction || "Voici la correction pour progresser.");
        setEvalAnswer("");
        return;
      }
      await reloadChildren();
      await loadSubjectsMeta();
      await loadGamification();
      setEvalItem(null);
      setEvalAnswer("");
      setEvalCorrection(null);
      const reward = result.unlockedMinutes ? ` +${result.unlockedMinutes} min de temps d'ecran.` : "";
      const xp = result.xpGain ? ` +${result.xpGain} XP.` : "";
      const verdict = result.passed ? "Evaluation reussie !" : "Evaluation terminee (niveau a renforcer).";
      const lastCorr = result.correction ? `\n\nDerniere question — correction :\n${result.correction}` : "";
      const tip = result.sessionTip ? `\n\n${result.sessionTip}` : "";
      Alert.alert("Resultat", `${verdict} Score final: ${result.finalScore || 0}/100.${reward}${xp}${lastCorr}${tip}`);
    } catch (error) {
      Alert.alert("Erreur", String(error));
    } finally {
      setEvalBusy(false);
    }
  };

  const createChild = async () => {
    if (
      !token ||
      !newChild.firstName?.trim() ||
      !newChild.age ||
      !newChild.studentLogin?.trim() ||
      !newChild.studentPassword
    ) {
      Alert.alert("Formulaire incomplet", "Remplis prenom, classe, age, identifiant et mot de passe eleve.");
      return;
    }
    if (newChild.studentPassword.length < 6) {
      Alert.alert("Mot de passe eleve", "Au moins 6 caracteres pour l'enfant.");
      return;
    }
    setErrorMessage("");
    try {
      await api.createChild(token, {
        firstName: newChild.firstName.trim(),
        grade: newChild.grade,
        age: Number(newChild.age),
        strengths: newChild.strengths,
        weaknesses: newChild.weaknesses,
        studentLogin: newChild.studentLogin.trim().toLowerCase(),
        studentPassword: newChild.studentPassword,
      });
      setNewChild({ ...EMPTY_CHILD_DRAFT });
      await reloadChildren();
      Alert.alert(
        "Profil cree",
        "Note bien l'identifiant et le mot de passe que tu viens de choisir : l'enfant en aura besoin sur son telephone."
      );
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const loadLesson = async () => {
    if (!token || !selectedChild) return;
    try {
      const result = await api.getLesson(token, selectedChild.id, subject);
      setLessonPrompt(result.lesson?.prompt || "Aucun contenu disponible.");
      if (subject === "Francais") {
        setDictationPrompt("Ecoute la phrase lue a voix haute puis ecris-la sans aide visuelle.");
        setDictationExpected(result.dictation?.expected || "");
      } else {
        setDictationPrompt(result.lesson?.prompt || "");
        setDictationExpected(result.lesson?.expected || "");
      }
      setReviewItemId(result.review?.id || null);
      setReviewPhrase(result.review?.phrase || "");
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  useEffect(() => {
    loadLesson();
  }, [subject, selectedChildId, token]);

  const proceedSession = async () => {
    if (!selectedChild || !token) return;

    if (step === "lecture") {
      setStep("dictee");
      return;
    }

    if (step === "dictee") {
      if (!dictationExpected) {
        setSessionFeedback("Cette matiere ne contient pas de dictee pour le moment.");
        setStep("reward");
        return;
      }
      try {
        const result = await api.submitDictation(token, selectedChild.id, {
          expected: dictationExpected,
          answer: dictationInput,
          subject,
        });
        const bonus =
          result.unlockedMinutes && result.unlockedMinutes > 0
            ? ` 🎉 +${result.unlockedMinutes} min de temps d'ecran debloquees.`
            : "";
        setSessionFeedback(`${result.feedback}${bonus}`);
        await reloadChildren();
        await loadGamification();
        setStep("correction");
      } catch (error) {
        setErrorMessage(String(error));
      }
      return;
    }

    if (step === "correction") {
      setStep("revision");
      return;
    }

    if (step === "revision") {
      if (reviewItemId) {
        try {
          await api.completeReview(token, reviewItemId, true);
        } catch (error) {
          setErrorMessage(String(error));
        }
      }
      setStep("reward");
      return;
    }

    if (step === "reward") {
      setStep("lecture");
      setDictationInput("");
      setSessionFeedback("");
      await reloadChildren();
      await loadLesson();
    }
  };

  const loadDashboard = async () => {
    if (!token) return;
    try {
      const data = await api.getDashboard(token);
      setDashboard(data.progress);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const loadRecommendations = async () => {
    if (!token || !selectedChild) return;
    try {
      const result = await api.getRecommendations(token, selectedChild.id);
      setRecommendations(Array.isArray(result.recommendations) ? result.recommendations : []);
      setCurriculumSources(Array.isArray(result.sources) ? result.sources : []);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const loadParentSettings = async () => {
    if (!token || sessionKind !== "parent") return;
    try {
      const s = await api.getParentSettings(token);
      setParentSettings(s);
    } catch {
      // no-op
    }
  };

  const loadParentNotifications = async () => {
    if (!token || sessionKind !== "parent") return;
    try {
      const rows = await api.getParentNotifications(token);
      setParentNotifications(rows);
    } catch {
      // no-op
    }
  };

  const saveParentSettings = async () => {
    if (!token || sessionKind !== "parent") return;
    try {
      await api.patchParentSettings(token, parentSettings);
      await loadParentSettings();
      Alert.alert("Parametres enregistres", "Les regles de temps d'ecran ont ete mises a jour.");
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const loadOnlinePrograms = async () => {
    if (!token || !selectedChild) return;
    try {
      const data = await api.getOnlinePrograms(token, selectedChild.id, subject);
      setOnlinePrograms(data.links || []);
    } catch {
      setOnlinePrograms([]);
    }
  };

  const loadGamification = async () => {
    if (!token || !selectedChild) return;
    try {
      const g = await api.getGamification(token, selectedChild.id);
      setGamification(g);
    } catch {
      setGamification(null);
    }
  };

  const chooseAvatar = async (avatarId: string) => {
    if (!token || !selectedChild) return;
    try {
      await api.patchAvatar(token, selectedChild.id, avatarId);
      await reloadChildren();
      await loadGamification();
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const addHomework = async () => {
    if (!token || !selectedChild || !homeworkTitle.trim()) return;
    try {
      await api.createHomework(token, selectedChild.id, {
        subject,
        title: homeworkTitle,
        details: "Ajoute manuellement depuis espace parent.",
        dueDate: "",
      });
      setHomeworkTitle("");
      const rows = await api.getHomework(token, selectedChild.id);
      setHomeworkList(rows);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const refreshHomework = async () => {
    if (!token || !selectedChild) return;
    try {
      const rows = await api.getHomework(token, selectedChild.id);
      setHomeworkList(rows);
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  useEffect(() => {
    refreshHomework();
  }, [selectedChildId, token]);

  useEffect(() => {
    loadRecommendations();
  }, [selectedChildId, token]);

  useEffect(() => {
    loadOnlinePrograms();
  }, [selectedChildId, token, subject]);

  useEffect(() => {
    loadGamification();
  }, [selectedChildId, token, role]);

  useEffect(() => {
    if (role === "parent") {
      loadParentSettings();
      loadParentNotifications();
    }
  }, [role, token]);

  if (role === "landing") {
    return (
      <SafeAreaView style={warmStyles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <Text style={warmStyles.heroEmoji}>📚✨</Text>
          <Text style={warmStyles.title}>EduCoach FR</Text>
          <Text style={warmStyles.subtitle}>{apiMessage}</Text>
          {!!getResolvedApiBase() && (
            <Text style={[warmStyles.hint, { marginTop: 6 }]} selectable>
              Serveur : {getResolvedApiBase()}
            </Text>
          )}
          {!getResolvedApiBase() && (
            <Text style={[warmStyles.hint, { marginTop: 6 }]}>
              Aucune URL API dans le bundle — configure config/publicApi.json puis relance avec npx expo start -c.
            </Text>
          )}
          {sessionLoading && <Text style={warmStyles.hint}>Chargement...</Text>}
          <Text style={warmStyles.sectionTitle}>Qui utilise l&apos;application ?</Text>
          <Text style={warmStyles.hint}>
            Les parents creent le profil de l&apos;enfant et choisissent son identifiant et son mot de passe. L&apos;enfant se connecte avec ces informations sans voir l&apos;espace parent.
          </Text>

          <TouchableOpacity style={warmStyles.btnPrimary} onPress={() => setRole("auth")}>
            <Text style={warmStyles.btnPrimaryText}>Parents et tuteurs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={warmStyles.btnSun} onPress={() => setRole("studentAuth")}>
            <Text style={warmStyles.btnSunText}>Je suis eleve</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "studentAuth") {
    return (
      <SafeAreaView style={warmStyles.screenAlt}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <Text style={[warmStyles.heroEmoji, { fontSize: 48 }]}>👋</Text>
          <Text style={warmStyles.titleLight}>Salut champion !</Text>
          <Text style={warmStyles.subtitle}>{apiMessage}</Text>
          {!!getResolvedApiBase() && (
            <Text style={[warmStyles.hint, { marginTop: 6 }]} selectable>
              Serveur : {getResolvedApiBase()}
            </Text>
          )}

          <Text style={warmStyles.sectionTitle}>Ta connexion</Text>
          <Text style={warmStyles.hint}>Demande a tes parents ton identifiant et ton mot de passe.</Text>
          <TextInput
            style={warmStyles.inputKid}
            placeholder="Identifiant"
            autoCapitalize="none"
            autoCorrect={false}
            value={kidLoginId}
            onChangeText={setKidLoginId}
          />
          <TextInput
            style={warmStyles.inputKid}
            placeholder="Mot de passe"
            secureTextEntry
            value={kidPassword}
            onChangeText={setKidPassword}
          />

          <TouchableOpacity style={warmStyles.btnSun} onPress={runKidAuth} disabled={authBusy}>
            {authBusy ? <ActivityIndicator color="#3d3d3d" /> : <Text style={warmStyles.btnSunText}>C&apos;est parti !</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={warmStyles.btnSoft} onPress={() => setRole("landing")}>
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "auth") {
    return (
      <SafeAreaView style={warmStyles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <Text style={warmStyles.heroEmoji}>🏠</Text>
          <Text style={warmStyles.title}>Espace parents</Text>
          <Text style={warmStyles.subtitle}>{apiMessage}</Text>
          {!!getResolvedApiBase() && (
            <Text style={[warmStyles.hint, { marginTop: 6 }]} selectable>
              Serveur : {getResolvedApiBase()}
            </Text>
          )}
          {sessionLoading && <Text style={warmStyles.hint}>Restauration de session en cours...</Text>}

          <Text style={warmStyles.sectionTitle}>Connexion parent / tuteur</Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.secondaryBtn, authMode === "register" ? styles.subjectBtnActive : undefined]}
              onPress={() => setAuthMode("register")}
            >
              <Text style={styles.btnText}>Inscription</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, authMode === "login" ? styles.subjectBtnActive : undefined]}
              onPress={() => setAuthMode("login")}
            >
              <Text style={styles.btnText}>Connexion</Text>
            </TouchableOpacity>
          </View>

          {authMode === "register" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Prenom parent"
                value={parentFirstName}
                onChangeText={setParentFirstName}
              />
              <TextInput
                style={styles.input}
                placeholder="Nom parent"
                value={parentLastName}
                onChangeText={setParentLastName}
              />
            </>
          )}
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={styles.primaryBtn} onPress={runAuth} disabled={authBusy}>
            {authBusy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>{authMode === "register" ? "Creer puis se connecter" : "Se connecter"}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("landing")}>
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "setup") {
    return (
      <SafeAreaView style={warmStyles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <Text style={warmStyles.heroEmoji}>⚙️</Text>
          <Text style={warmStyles.title}>Configuration</Text>
          <Text style={warmStyles.subtitle}>Parent : {parentName}</Text>

          <Text style={styles.sectionTitle}>Ajouter un profil enfant</Text>
          <Text style={styles.hint}>Choisis la classe sur la liste (du CP a la Terminale). Pour l&apos;enfant, seul le prenom est demande au profil.</Text>
          <TextInput style={styles.input} placeholder="Prenom" value={newChild.firstName} onChangeText={(v) => setNewChild((p) => ({ ...p, firstName: v }))} />
          <TouchableOpacity style={styles.inputLikePicker} onPress={() => setGradePickerOpen(true)}>
            <Text style={styles.inputLikePickerLabel}>Classe</Text>
            <Text style={styles.inputLikePickerValue}>{newChild.grade}</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} placeholder="Age" value={newChild.age} onChangeText={(v) => setNewChild((p) => ({ ...p, age: v }))} keyboardType="numeric" />
          <TextInput
            style={styles.input}
            placeholder="Identifiant eleve (ex: lina_cp)"
            autoCapitalize="none"
            autoCorrect={false}
            value={newChild.studentLogin}
            onChangeText={(v) => setNewChild((p) => ({ ...p, studentLogin: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe eleve (min. 6 caracteres)"
            secureTextEntry
            value={newChild.studentPassword}
            onChangeText={(v) => setNewChild((p) => ({ ...p, studentPassword: v }))}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={createChild}>
            <Text style={styles.btnText}>Ajouter l'enfant</Text>
          </TouchableOpacity>

          <Modal transparent animationType="fade" visible={gradePickerOpen} onRequestClose={() => setGradePickerOpen(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Choisis la classe</Text>
                <ScrollView style={styles.gradeList} keyboardShouldPersistTaps="handled">
                  {FR_GRADES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gradeRow, newChild.grade === g ? styles.gradeRowActive : undefined]}
                      onPress={() => {
                        setNewChild((p) => ({ ...p, grade: g }));
                        setGradePickerOpen(false);
                      }}
                    >
                      <Text style={styles.gradeRowText}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setGradePickerOpen(false)}>
                  <Text style={styles.btnText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Text style={styles.sectionTitle}>Enfants</Text>
          {children.map((child) => (
            <TouchableOpacity
              key={child.id}
              style={[styles.card, selectedChildId === child.id ? styles.cardSelected : undefined]}
              onPress={() => setSelectedChildId(child.id)}
            >
              <Text style={styles.cardTitle}>
                {child.first_name} - {child.grade}
              </Text>
              <Text>Points: {child.points}</Text>
              {child.student_login ? (
                <Text style={styles.hint}>Identifiant eleve : {child.student_login}</Text>
              ) : (
                <Text style={styles.hint}>Ancien profil sans identifiant eleve : ajoute un nouveau profil avec identifiant.</Text>
              )}
            </TouchableOpacity>
          ))}

          {selectedChild && subjectsMeta?.optionalPool && subjectsMeta.optionalPool.length > 0 ? (
            <View style={[warmStyles.card, warmStyles.cardLift]}>
              <Text style={warmStyles.sectionTitle}>Matieres optionnelles (classe {selectedChild.grade})</Text>
              <Text style={warmStyles.hint}>
                Coche les matieres supplementaires que tu autorises pour cet enfant (non prevues dans ta classe par defaut).
              </Text>
              {subjectsMeta.optionalPool.map((s) => {
                const on = parentOptionalDraft.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={{ paddingVertical: 8 }}
                    onPress={() =>
                      setParentOptionalDraft((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                    }
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800", color: T.ink }}>
                      {on ? "✓ " : "○ "}
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={warmStyles.btnPrimary} onPress={saveParentOptional}>
                <Text style={warmStyles.btnPrimaryText}>Enregistrer les matieres optionnelles</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { loadDashboard(); setRole("parent"); }}>
              <Text style={styles.btnText}>Vue Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("student")}>
              <Text style={styles.btnText}>Vue Eleve</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={logout}>
            <Text style={styles.btnText}>Deconnexion</Text>
          </TouchableOpacity>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "parent") {
    return (
      <SafeAreaView style={warmStyles.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <Text style={warmStyles.heroEmoji}>👨‍👩‍👧</Text>
          <Text style={warmStyles.title}>Espace Parent</Text>
          <Text style={warmStyles.subtitle}>Suivi et devoirs</Text>

          {dashboard.map((item) => (
            <View key={item.childId} style={styles.card}>
              <Text style={styles.cardTitle}>{item.childName}</Text>
              <Text>Niveau lecture: {item.readingLevel}/3</Text>
              <Text>Niveau orthographe: {item.spellingLevel}/3</Text>
              <Text>Points: {item.points}</Text>
              <Text>Temps d'ecran debloque: {item.screenTimeUnlockedMin || 0} min</Text>
              <Text>
                Fort: {item.strongestSubject || "-"} · A renforcer: {item.weakestSubject || "-"}
              </Text>
              <Text>Revisions en attente: {item.pendingReviews}</Text>
            </View>
          ))}

          <View style={[warmStyles.card, warmStyles.cardLift]}>
            <Text style={warmStyles.sectionTitle}>Regles temps d'ecran</Text>
            <Text style={warmStyles.hint}>Minutes debloquees quand l'enfant reussit une activite (score {'>='} 85).</Text>
            <TextInput
              style={warmStyles.input}
              keyboardType="numeric"
              value={String(parentSettings.rewardMinutesPerSuccess)}
              onChangeText={(v) => setParentSettings((p) => ({ ...p, rewardMinutesPerSuccess: Number(v || 0) }))}
              placeholder="Minutes par succes"
            />
            <TouchableOpacity
              style={[warmStyles.btnSoft, { backgroundColor: parentSettings.notifyOnUnlock ? "#5cbf8a" : "#aab2c5" }]}
              onPress={() => setParentSettings((p) => ({ ...p, notifyOnUnlock: !p.notifyOnUnlock }))}
            >
              <Text style={styles.btnText}>
                Notification parent : {parentSettings.notifyOnUnlock ? "activee" : "desactivee"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={warmStyles.btnPrimary} onPress={saveParentSettings}>
              <Text style={warmStyles.btnPrimaryText}>Enregistrer regles</Text>
            </TouchableOpacity>
          </View>

          <View style={[warmStyles.card, warmStyles.cardLift]}>
            <Text style={warmStyles.sectionTitle}>Notifications parent</Text>
            {parentNotifications.length === 0 ? (
              <Text style={warmStyles.hint}>Aucune notification pour le moment.</Text>
            ) : (
              parentNotifications.slice(0, 8).map((n) => (
                <Text key={`notif-${n.id}`} style={warmStyles.hint}>
                  - {n.message}
                </Text>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>Ajout devoir (import manuel / Pronote)</Text>
          <TextInput style={styles.input} value={homeworkTitle} onChangeText={setHomeworkTitle} placeholder="Ex: Exercice de conjugaison p.42" />
          <TouchableOpacity style={styles.primaryBtn} onPress={addHomework}>
            <Text style={styles.btnText}>Ajouter devoir a l'enfant selectionne</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Pronote: endpoint prevu, integration officielle a finaliser.</Text>

          {homeworkList.map((hw) => (
            <View style={styles.card} key={hw.id}>
              <Text style={styles.cardTitle}>{hw.subject} - {hw.title}</Text>
              <Text>Source: {hw.source}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Recommandations pedagogiques (programme FR)</Text>
          {(recommendations ?? []).map((rec, idx) => (
            <View style={styles.card} key={`${rec.subject}-${idx}`}>
              <Text style={styles.cardTitle}>{rec.subject}</Text>
              <Text style={styles.hint}>Competences prioritaires:</Text>
              {rec.competencies?.map((c: string, i: number) => (
                <Text key={`${rec.subject}-c-${i}`}>- {c}</Text>
              ))}
              <Text style={styles.hint}>Micro-programmes proposes:</Text>
              {rec.microLessons?.map((m: any, i: number) => (
                <Text key={`${rec.subject}-m-${i}`}>- {m.title} ({m.durationMin} min)</Text>
              ))}
            </View>
          ))}
          {!!curriculumNote && <Text style={styles.hint}>{curriculumNote}</Text>}

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("setup")}>
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={logout}>
            <Text style={styles.btnText}>Deconnexion</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "student" && selectedChild) {
    const displayChild = selectedChild;
    const ranked = Object.entries(displayChild.subjectTiersDisplay || {}).sort(
      (a, b) => (b[1]?.tier || 1) - (a[1]?.tier || 1)
    );
    const strongest = ranked[0]?.[0] || "Francais";
    const weakest = ranked[ranked.length - 1]?.[0] || "Francais";
    return (
      <SafeAreaView style={warmStyles.screenAlt}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <Text style={warmStyles.heroEmoji}>🌟📖</Text>
          <Text style={warmStyles.titleLight}>Salut {displayChild?.first_name || "champion"} !</Text>
          <Text style={warmStyles.subtitle}>
            Points {displayChild?.points ?? 0} · Classe {displayChild?.grade}
          </Text>

          <View style={warmStyles.tabBar}>
            <TouchableOpacity
              style={[warmStyles.tab, studentTab === "home" ? warmStyles.tabOn : undefined]}
              onPress={() => setStudentTab("home")}
            >
              <Text style={[warmStyles.tabText, studentTab === "home" ? warmStyles.tabTextOn : undefined]}>Accueil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[warmStyles.tab, studentTab === "eval" ? warmStyles.tabOn : undefined]}
              onPress={() => setStudentTab("eval")}
            >
              <Text style={[warmStyles.tabText, studentTab === "eval" ? warmStyles.tabTextOn : undefined]}>Evaluations</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[warmStyles.tab, studentTab === "learn" ? warmStyles.tabOn : undefined]}
              onPress={() => setStudentTab("learn")}
            >
              <Text style={[warmStyles.tabText, studentTab === "learn" ? warmStyles.tabTextOn : undefined]}>Apprendre</Text>
            </TouchableOpacity>
          </View>

          {studentTab === "home" && displayChild && (
            <>
              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Tes niveaux par matiere</Text>
                <Text style={warmStyles.hint}>
                  E, M ou A = pas encore au programme officiel, c&apos;est notre echelle pour te guider (E = essentiel, M =
                  confort, A = avance). Chaque matiere evolue separement !
                </Text>
                {activeSubjectsList.map((sub) => {
                  const disp = displayChild.subjectTiersDisplay?.[sub];
                  const tier = disp?.label || "E";
                  return (
                    <View key={sub} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 6 }}>
                      <Text style={{ fontWeight: "800", color: T.ink, fontSize: 16 }}>{sub}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={warmStyles.tierBadge}>
                          <Text style={warmStyles.tierText}>
                            {tier} · {displayChild.grade}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
                <Text style={warmStyles.hint}>Tu es le plus a l'aise en {strongest}.</Text>
                <Text style={warmStyles.hint}>On va surtout t'aider en {weakest}.</Text>
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Avatar et progression</Text>
                <Text style={warmStyles.hint}>
                  Avatar actuel: {gamification?.avatarId || displayChild.avatar_id || "fox"} · XP: {gamification?.xpTotal || displayChild.xp_total || 0} · Serie:{" "}
                  {gamification?.streakDays || displayChild.streak_days || 0} jour(s)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[warmStyles.pillRow, { flexDirection: "row" }]}>
                    {(gamification?.avatars || ["fox", "owl", "lion", "dolphin", "cat", "rocket"]).map((a) => (
                      <TouchableOpacity
                        key={`av-${a}`}
                        style={[
                          warmStyles.pill,
                          (gamification?.avatarId || displayChild.avatar_id || "fox") === a ? warmStyles.pillActive : undefined,
                        ]}
                        onPress={() => chooseAvatar(a)}
                      >
                        <Text style={[styles.btnText, (gamification?.avatarId || displayChild.avatar_id || "fox") === a ? undefined : { color: T.ink }]}>
                          {a}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Badges</Text>
                {(gamification?.badges || displayChild.badges || []).length === 0 ? (
                  <Text style={warmStyles.hint}>Continue, ton premier badge arrive vite !</Text>
                ) : (
                  (gamification?.badges || displayChild.badges || []).map((b, i) => (
                    <Text key={`badge-${i}`} style={warmStyles.hint}>
                      - 🏅 {b}
                    </Text>
                  ))
                )}
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Quetes du jour</Text>
                {(gamification?.quests || []).map((q) => (
                  <Text key={q.id} style={warmStyles.hint}>
                    {q.completed ? "✅" : "⬜"} {q.title}
                  </Text>
                ))}
              </View>
            </>
          )}

          {studentTab === "eval" && displayChild && (
            <>
              <Text style={warmStyles.sectionTitle}>Une evaluation par matiere</Text>
              <Text style={warmStyles.hint}>Quand c&apos;est valide, un petit vert apparait. Tu peux repasser une eval pour t&apos;ameliorer.</Text>
              {activeSubjectsList.map((sub) => {
                const done = displayChild.evaluationBySubject?.[sub]?.done;
                return (
                  <View key={`ev-${sub}`} style={[warmStyles.card, warmStyles.cardLift]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontWeight: "900", fontSize: 17, color: T.ink }}>{sub}</Text>
                      {done ? (
                        <View style={warmStyles.chipGreen}>
                          <Text style={{ fontWeight: "800", color: T.mintDark }}>Fait</Text>
                          <View style={warmStyles.doneDot} />
                        </View>
                      ) : (
                        <Text style={warmStyles.hint}>A faire</Text>
                      )}
                    </View>
                    {evalItem?.subject === sub ? (
                      <>
                        {evalCorrection !== null ? (
                          <View style={[warmStyles.blockFun, { marginBottom: 10 }]}>
                            <Text style={{ fontWeight: "800", fontSize: 16, color: T.ink, marginBottom: 8 }}>Correction</Text>
                            <Text style={{ fontSize: 15, color: T.ink, lineHeight: 22 }}>{evalCorrection}</Text>
                            <TouchableOpacity style={warmStyles.btnSun} onPress={() => speakFrench(evalCorrection)}>
                              <Text style={warmStyles.btnSunText}>Ecouter la correction</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={warmStyles.btnPrimary} onPress={() => void advanceEvalAfterCorrection()} disabled={evalBusy}>
                              {evalBusy ? <ActivityIndicator color="#fff" /> : <Text style={warmStyles.btnPrimaryText}>Question suivante</Text>}
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <Text style={warmStyles.hint}>
                              Question {evalItem.index}/{evalItem.total}
                            </Text>
                            <Text style={warmStyles.hint}>{evalItem.prompt}</Text>
                            <TouchableOpacity style={warmStyles.btnSun} onPress={() => speakFrench(evalItem.readAloudText)}>
                              <Text style={warmStyles.btnSunText}>Reecouter</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={warmStyles.inputKid}
                              value={evalAnswer}
                              onChangeText={setEvalAnswer}
                              placeholder={
                                evalItem.exerciseType === "dictee" || evalItem.exerciseType === "french-dictation"
                                  ? "Ecris la phrase"
                                  : "Ta reponse"
                              }
                              multiline={
                                evalItem.exerciseType === "dictee" ||
                                evalItem.exerciseType === "french-dictation" ||
                                evalItem.exerciseType === "french-reading"
                              }
                            />
                            <TouchableOpacity style={warmStyles.btnPrimary} onPress={submitEvalSession} disabled={evalBusy}>
                              {evalBusy ? <ActivityIndicator color="#fff" /> : <Text style={warmStyles.btnPrimaryText}>Valider</Text>}
                            </TouchableOpacity>
                          </>
                        )}
                        <TouchableOpacity
                          style={warmStyles.btnSoft}
                          onPress={() => {
                            setEvalItem(null);
                            setEvalAnswer("");
                            setEvalCorrection(null);
                          }}
                        >
                          <Text style={styles.btnText}>Annuler</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={warmStyles.btnPrimary} onPress={() => startEvalSubject(sub)} disabled={evalBusy}>
                        <Text style={warmStyles.btnPrimaryText}>{done ? "Refaire" : "Commencer"}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {studentTab === "learn" && displayChild && (
            <>
              <Text style={warmStyles.sectionTitle}>Choisis une matiere</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={[warmStyles.pillRow, { flexDirection: "row" }]}>
                  {activeSubjectsList.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[warmStyles.pill, subject === s ? warmStyles.pillActive : undefined]}
                      onPress={() => setSubject(s)}
                    >
                      <Text style={[styles.btnText, subject === s ? undefined : { color: T.ink, fontWeight: "800" }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Lecture</Text>
                <View style={warmStyles.blockFun}>
                  <Text style={{ fontSize: 16, lineHeight: 24, color: T.ink }}>{lessonPrompt}</Text>
                </View>
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Exercice (dictee orale ou question)</Text>
                <Text style={warmStyles.hint}>Etape : {step === "lecture" ? "Lecture" : step}</Text>

                {step === "lecture" && (
                  <TouchableOpacity style={warmStyles.btnSun} onPress={() => setStep("dictee")}>
                    <Text style={warmStyles.btnSunText}>Je passe a l&apos;exercice</Text>
                  </TouchableOpacity>
                )}

                {step === "dictee" && (
                  <>
                    <View style={warmStyles.blockFun}>
                      <Text style={{ fontSize: 16, color: T.ink }}>{dictationPrompt}</Text>
                    </View>
                    <TouchableOpacity style={warmStyles.btnSun} onPress={() => speakDicteePhrase(dictationPrompt, dictationExpected)}>
                      <Text style={warmStyles.btnSunText}>Entendre la phrase</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[warmStyles.inputKid, { minHeight: 100, textAlignVertical: "top" }]}
                      value={dictationInput}
                      onChangeText={setDictationInput}
                      multiline={subject === "Francais"}
                      placeholder={subject === "Francais" ? "Ecris la phrase ici" : "Ta reponse"}
                    />
                    <TouchableOpacity style={warmStyles.btnPrimary} onPress={proceedSession}>
                      <Text style={warmStyles.btnPrimaryText}>Valider</Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === "correction" && (
                  <View style={warmStyles.blockFun}>
                    <Text style={{ fontSize: 16, color: T.ink }}>{sessionFeedback}</Text>
                    <TouchableOpacity style={warmStyles.btnPrimary} onPress={proceedSession}>
                      <Text style={warmStyles.btnPrimaryText}>Continuer</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === "revision" && (
                  <View style={warmStyles.blockFun}>
                    <Text style={{ fontSize: 16, color: T.ink }}>Revision : {reviewPhrase}</Text>
                    <TouchableOpacity style={warmStyles.btnPrimary} onPress={proceedSession}>
                      <Text style={warmStyles.btnPrimaryText}>J&apos;ai revise</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === "reward" && (
                  <View style={warmStyles.blockFun}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: T.mintDark }}>Bravo !</Text>
                    <Text style={warmStyles.hint}>Tu gagnes des points et une mini recompense.</Text>
                    <Text style={warmStyles.hint}>Blague : Pourquoi le livre est fatigue ? Parce qu&apos;il a trop de feuilles !</Text>
                    <TouchableOpacity style={warmStyles.btnSun} onPress={proceedSession}>
                      <Text style={warmStyles.btnSunText}>Mission suivante</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Idees pour {displayChild.grade}</Text>
                {recommendations
                  .filter((r) => r.subject === subject)
                  .flatMap((r) => r.microLessons || [])
                  .slice(0, 3)
                  .map((lesson: { title: string; durationMin: number }, idx: number) => (
                    <Text key={`lesson-${idx}`} style={warmStyles.hint}>
                      - {lesson.title} (~{lesson.durationMin} min)
                    </Text>
                  ))}
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Programmes en ligne ({displayChild.grade})</Text>
                {onlinePrograms.length === 0 ? (
                  <Text style={warmStyles.hint}>Aucun lien disponible.</Text>
                ) : (
                  onlinePrograms.slice(0, 8).map((lnk, idx) => (
                    <Text key={`prog-${idx}`} style={warmStyles.hint}>
                      - [{lnk.subject}] {lnk.title}: {lnk.url}
                    </Text>
                  ))
                )}
              </View>
            </>
          )}

          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <TouchableOpacity
            style={styles.kidSecondaryBtn}
            onPress={() => {
              if (sessionKind === "student") logoutStudent();
              else setRole("setup");
            }}
          >
            <Text style={styles.kidBtnDarkText}>{sessionKind === "student" ? "Quitter mon espace" : "Retour configuration"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "student" && !selectedChild) {
    return (
      <SafeAreaView style={warmStyles.screen}>
        <ScrollView contentContainerStyle={warmStyles.pad}>
          <Text style={warmStyles.title}>Selectionne un enfant dans la configuration.</Text>
          <TouchableOpacity style={warmStyles.btnPrimary} onPress={() => setRole("setup")}>
            <Text style={warmStyles.btnPrimaryText}>Retour configuration</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  studentBg: { backgroundColor: "#e9f7fe" },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#1d2b64" },
  studentHeroTitle: { fontSize: 28, color: "#0f3460" },
  landingEmoji: { fontSize: 36, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#4c5c96" },
  studentSubtitle: { fontSize: 16, color: "#1e4976", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#d4daf0", backgroundColor: "white", borderRadius: 10, padding: 10 },
  kidInput: { borderWidth: 2, borderColor: "#ffcf71", backgroundColor: "white", borderRadius: 14, padding: 14, fontSize: 17 },
  inputLikePicker: {
    borderWidth: 1,
    borderColor: "#d4daf0",
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  inputLikePickerLabel: { fontSize: 11, color: "#59638f", textTransform: "uppercase", letterSpacing: 0.5 },
  inputLikePickerValue: { fontSize: 17, fontWeight: "700", color: "#1d2b64" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  card: { backgroundColor: "white", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#dbe0f5", gap: 6 },
  cardSelected: { borderColor: "#4152c9", borderWidth: 2 },
  kidCard: { borderRadius: 16, borderColor: "#b8e0ff", borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  block: { backgroundColor: "#f0f4ff", padding: 10, borderRadius: 8 },
  hint: { color: "#59638f", fontSize: 12 },
  errorText: { color: "#b01919", fontSize: 12 },
  primaryBtn: { backgroundColor: "#4152c9", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  kidPrimaryBtn: {
    backgroundColor: "#ffc93c",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#f6b629",
  },
  secondaryBtn: { backgroundColor: "#6878e6", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", marginTop: 6 },
  kidSecondaryBtn: {
    backgroundColor: "#fdeedc",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#f4cfa8",
  },
  kidBtnText: { color: "#3d3d3d", fontWeight: "800", fontSize: 17 },
  kidBtnDarkText: { color: "#3d2918", fontWeight: "800" },
  subjectBtn: { backgroundColor: "#95a1e6", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  kidSubjectBtn: { backgroundColor: "#79cbdc", borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  subjectBtnActive: { backgroundColor: "#4152c9" },
  btnText: { color: "white", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 30, 60, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalSheet: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    maxHeight: "70%",
    gap: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#1d2b64", marginBottom: 4 },
  gradeList: { maxHeight: 320 },
  gradeRow: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#e8eaf7" },
  gradeRowActive: { backgroundColor: "#eef3ff" },
  gradeRowText: { fontSize: 17, color: "#1d2b64", fontWeight: "600" },
});
