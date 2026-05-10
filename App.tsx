import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { SafeAreaProvider, SafeAreaView as SafeInsetView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppScreenHero } from "./src/components/AppScreenHero";
import { LottieLoop } from "./src/components/LottieLoop";
import { StudentBottomNav } from "./src/components/StudentBottomNav";
import { Icon } from "./src/ui/Icon";
import {
  api,
  getResolvedApiBase,
  type Child,
  type GamificationState,
  type InterestCatalogPayload,
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

/** Conseils coach — ton bienveillant type assistants éducatifs modernes */
const COACH_TIPS = [
  "Les meilleures apps educatives ont un secret : des petites sessions souvent, plutot qu'une seule grosse seance. Tu es sur la bonne voie.",
  "Chaque erreur est une marche vers la reussite — comme sur Khan Academy, on repete jusqu'a ce que ce soit facile.",
  "Ton coach virtuel te dit : respire, lis bien la question, puis avance question par question.",
  "La progression, ce n'est pas la vitesse : c'est la regularite. Un peu chaque jour transforme tout.",
];

const SPARKLE_LOTTIE = require("./assets/lottie/sparkle.json");
const CELEBRATION_LOTTIE = require("./assets/lottie/celebration.json");

function AppContent() {
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
  const [interestCatalog, setInterestCatalog] = useState<InterestCatalogPayload | null>(null);
  const [interestCatModalOpen, setInterestCatModalOpen] = useState(false);
  const [interestFavModalOpen, setInterestFavModalOpen] = useState(false);
  const [interestDraftCategoryId, setInterestDraftCategoryId] = useState("");
  const [interestDraftFavoriteId, setInterestDraftFavoriteId] = useState("");
  const [interestSaving, setInterestSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const interestOptionsForCategory = useMemo(() => {
    if (!interestCatalog || !interestDraftCategoryId) return [];
    return interestCatalog.categories.find((c) => c.id === interestDraftCategoryId)?.options ?? [];
  }, [interestCatalog, interestDraftCategoryId]);

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  );

  useEffect(() => {
    if (role !== "student") return;
    void api.getInterestCatalog().then(setInterestCatalog).catch(() => setInterestCatalog(null));
  }, [role]);

  useEffect(() => {
    if (role !== "student" || !selectedChild) return;
    const it = selectedChild.interestTheme;
    if (it?.categoryId && it?.favoriteId) {
      setInterestDraftCategoryId(it.categoryId);
      setInterestDraftFavoriteId(it.favoriteId);
    } else {
      setInterestDraftCategoryId("");
      setInterestDraftFavoriteId("");
    }
  }, [role, selectedChild?.id, selectedChild?.interestTheme?.favoriteId]);

  const persistStudentInterests = async () => {
    if (!token || sessionKind !== "student" || !selectedChild) return;
    if (!interestDraftCategoryId || !interestDraftFavoriteId) {
      Alert.alert("Choix incomplet", "Choisis un domaine puis une passion dans la deuxieme liste.");
      return;
    }
    setInterestSaving(true);
    try {
      const res = await api.patchChildInterests(token, selectedChild.id, {
        categoryId: interestDraftCategoryId,
        favoriteId: interestDraftFavoriteId,
      });
      setChildren([res.child]);
      Alert.alert("Enregistre", `Les exercices utiliseront souvent : ${res.interestTheme?.favoriteLabel ?? ""}.`);
    } catch (e) {
      Alert.alert("Erreur", String(e));
    } finally {
      setInterestSaving(false);
    }
  };

  const clearStudentInterests = async () => {
    if (!token || sessionKind !== "student" || !selectedChild) return;
    setInterestSaving(true);
    try {
      const res = await api.patchChildInterests(token, selectedChild.id, { clear: true });
      setChildren([res.child]);
      setInterestDraftCategoryId("");
      setInterestDraftFavoriteId("");
    } catch (e) {
      Alert.alert("Erreur", String(e));
    } finally {
      setInterestSaving(false);
    }
  };

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

  const speak = (text: string) => {
    if (!text?.trim()) return;
    Speech.stop();
    Speech.speak(text.trim(), { language: "fr-FR", rate: 0.92, pitch: 1.0 });
  };

  const speakDicteePhrase = (prompt: string, expected: string) => {
    const p = String(prompt || "");
    if (/^Ecris\s*:/i.test(p)) speak(String(expected || "").trim());
    else speak(String(expected || prompt || "").trim());
  };

  const activeSubjectsList = useMemo(() => {
    if (subjectsMeta?.activeSubjects?.length) return subjectsMeta.activeSubjects;
    return ["Francais", "Maths", "Histoire"];
  }, [subjectsMeta]);

  const startEvalSubject = async (sub: string) => {
    if (!token || !selectedChild) return;
    setEvalBusy(true);
    setErrorMessage("");
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
      if (autoSpeak) setTimeout(() => speak(q.readAloudText), 400);
    } catch (error) {
      Alert.alert("Impossible", String(error));
    } finally {
      setEvalBusy(false);
    }
  };

  const submitEvalSession = async () => {
    if (!token || !selectedChild || !evalItem) return;
    setEvalBusy(true);
    try {
      const result = await api.answerEvaluationQuestion(token, evalItem.sessionId, evalAnswer);
      if (!result.finished) {
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
        if (autoSpeak) setTimeout(() => speak(q.readAloudText), 300);
      } else {
        await reloadChildren();
        await loadSubjectsMeta();
        await loadGamification();
        setEvalItem(null);
        setEvalAnswer("");
        const reward = result.unlockedMinutes ? ` +${result.unlockedMinutes} min de temps d'ecran.` : "";
        const xp = result.xpGain ? ` +${result.xpGain} XP.` : "";
        const verdict = result.passed ? "Evaluation reussie !" : "Evaluation terminee (niveau a renforcer).";
        Alert.alert("Resultat", `${verdict} Score final: ${result.finalScore || 0}/100.${reward}${xp}`);
      }
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
          <AppScreenHero
            badge="Apprendre en confiance"
            title="EduCoach"
            subtitle="Un parcours clair, comme sur les meilleures apps educatives : progression par petits pas, feedback tout de suite, et recompenses pour rester motive."
            variant="mint"
            decoration={
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 18 }}>
                <Icon name="school-outline" size={42} color={T.primary} />
                <Icon name="chart-timeline-variant" size={38} color={T.accent} />
                <Icon name="trophy-outline" size={40} color={T.amber} />
              </View>
            }
          />
          <Text style={[warmStyles.caption, { textAlign: "center", marginBottom: 14 }]}>{apiMessage}</Text>
          {!!getResolvedApiBase() && (
            <Text style={[warmStyles.caption, { textAlign: "center", marginBottom: 6 }]} selectable>
              Serveur : {getResolvedApiBase()}
            </Text>
          )}
          {!getResolvedApiBase() && (
            <Text style={[warmStyles.caption, { textAlign: "center", marginBottom: 8 }]}>
              Aucune URL API dans le bundle — configure config/publicApi.json puis relance avec npx expo start -c.
            </Text>
          )}
          {sessionLoading && (
            <Text style={[warmStyles.hint, { textAlign: "center", marginBottom: 8 }]}>Chargement...</Text>
          )}

          <View style={[warmStyles.cardLift, warmStyles.card, { marginTop: 4 }]}>
            <Text style={warmStyles.sectionTitle}>Pour qui ?</Text>
            <Text style={[warmStyles.hint, { marginTop: 4 }]}>
              · Parents et tuteurs : creent le profil, la classe, et les codes de connexion de l&apos;enfant.
            </Text>
            <Text style={warmStyles.hint}>
              · Eleves : un espace simple pour apprendre, sans voir le tableau de bord adulte.
            </Text>
          </View>

          <TouchableOpacity style={[warmStyles.btnPrimary, { marginTop: 6 }]} onPress={() => setRole("auth")}>
            <Text style={warmStyles.btnPrimaryText}>Espace parents et tuteurs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={warmStyles.btnOutline} onPress={() => setRole("studentAuth")}>
            <Text style={warmStyles.btnOutlineText}>Je suis eleve — me connecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "studentAuth") {
    return (
      <SafeAreaView style={warmStyles.screenAlt}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={warmStyles.pad}>
          <AppScreenHero
            variant="purple"
            badge="Eleve"
            title="Salut champion !"
            subtitle={apiMessage}
            accentBarColor={T.accent}
            decoration={<Icon name="human-greeting-variant" size={52} color={T.primary} />}
          />
          {!!getResolvedApiBase() && (
            <Text style={[warmStyles.caption, { textAlign: "center", marginBottom: 12 }]} selectable>
              Serveur : {getResolvedApiBase()}
            </Text>
          )}

          <View style={warmStyles.authCard}>
            <Text style={warmStyles.sectionTitle}>Connexion eleve</Text>
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
              {authBusy ? <ActivityIndicator color="#2D2208" /> : <Text style={warmStyles.btnSunText}>C&apos;est parti !</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={warmStyles.btnGhost} onPress={() => setRole("landing")}>
            <Text style={{ color: T.accent, fontWeight: "700", fontSize: 15 }}>← Retour</Text>
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
          <AppScreenHero
            badge="Parents"
            title="Espace familles"
            subtitle={apiMessage}
            decoration={
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16 }}>
                <Icon name="shield-account-outline" size={40} color={T.primary} />
                <Icon name="home-variant-outline" size={42} color={T.accent} />
              </View>
            }
          />
          {!!getResolvedApiBase() && (
            <Text style={[warmStyles.caption, { textAlign: "center", marginBottom: 8 }]} selectable>
              Serveur : {getResolvedApiBase()}
            </Text>
          )}
          {sessionLoading && (
            <Text style={[warmStyles.hint, { textAlign: "center", marginBottom: 10 }]}>Restauration de session...</Text>
          )}

          <View style={warmStyles.authCard}>
            <View style={warmStyles.segmentAuth}>
              <TouchableOpacity
                style={[warmStyles.segmentAuthItem, authMode === "register" ? warmStyles.segmentAuthItemOn : undefined]}
                onPress={() => setAuthMode("register")}
              >
                <Text style={[warmStyles.segmentAuthLabel, authMode === "register" ? warmStyles.segmentAuthLabelOn : undefined]}>
                  Inscription
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[warmStyles.segmentAuthItem, authMode === "login" ? warmStyles.segmentAuthItemOn : undefined]}
                onPress={() => setAuthMode("login")}
              >
                <Text style={[warmStyles.segmentAuthLabel, authMode === "login" ? warmStyles.segmentAuthLabelOn : undefined]}>
                  Connexion
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === "register" && (
              <>
                <TextInput
                  style={warmStyles.input}
                  placeholder="Prenom parent"
                  value={parentFirstName}
                  onChangeText={setParentFirstName}
                />
                <TextInput style={warmStyles.input} placeholder="Nom parent" value={parentLastName} onChangeText={setParentLastName} />
              </>
            )}
            <TextInput style={warmStyles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <TextInput
              style={warmStyles.input}
              placeholder="Mot de passe (min. 8 caracteres)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={warmStyles.btnPrimary} onPress={runAuth} disabled={authBusy}>
              {authBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={warmStyles.btnPrimaryText}>
                  {authMode === "register" ? "Creer mon compte et entrer" : "Me connecter"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={warmStyles.btnGhost} onPress={() => setRole("landing")}>
            <Text style={{ color: T.accent, fontWeight: "700", fontSize: 15 }}>← Retour accueil</Text>
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
          <AppScreenHero
            badge="Famille"
            title="Configuration"
            subtitle={`Compte parent : ${parentName}`}
            decoration={<Icon name="cog-outline" size={48} color={T.accent} />}
          />

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
          <AppScreenHero
            badge="Suivi"
            title="Espace parent"
            subtitle="Tableau de bord : progression, devoirs et recommandations du programme."
            decoration={
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 14 }}>
                <Icon name="account-child-outline" size={44} color={T.primary} />
                <Icon name="chart-box-outline" size={42} color={T.accent} />
              </View>
            }
          />

          {dashboard.map((item) => (
            <View key={item.childId} style={[styles.card, warmStyles.cardLift]}>
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
    const xpTotal = gamification?.xpTotal ?? displayChild.xp_total ?? 0;
    let xpPct = xpTotal % 100;
    if (xpTotal > 0 && xpPct === 0) xpPct = 100;
    if (xpTotal === 0) xpPct = 6;
    const coachTip =
      COACH_TIPS[
        ((displayChild.first_name?.length ?? 0) + (displayChild.id ?? 0) + new Date().getDate()) % COACH_TIPS.length
      ];
    return (
      <SafeInsetView style={[warmStyles.screenAlt, { flex: 1 }]} edges={["top", "left", "right"]}>
        <View style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[warmStyles.pad, { paddingBottom: insets.bottom + 92 }]}
          >
          <View style={warmStyles.coachBubble}>
            <View style={{ alignItems: "center", width: 76 }}>
              <LottieLoop source={SPARKLE_LOTTIE} width={52} height={52} />
              <Icon name="face-agent" size={30} color={T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={warmStyles.coachText}>{coachTip}</Text>
              <Text style={warmStyles.coachHint}>Astuce : avance etape par etape — une question a la fois.</Text>
            </View>
          </View>

          <Text style={[warmStyles.titleLight, { marginBottom: 6 }]}>Salut {displayChild?.first_name || "champion"} !</Text>
          <View style={warmStyles.statRow}>
            <View style={[warmStyles.statPill, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
              <Icon name="star-circle-outline" size={18} color={T.amber} />
              <Text style={warmStyles.statPillText}>{displayChild?.points ?? 0} pts</Text>
            </View>
            <View style={[warmStyles.statPill, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
              <Icon name="school-outline" size={18} color={T.accent} />
              <Text style={warmStyles.statPillText}>{displayChild?.grade}</Text>
            </View>
            <View style={[warmStyles.statPill, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
              <Icon name="fire" size={18} color="#F76707" />
              <Text style={warmStyles.statPillText}>{gamification?.streakDays ?? displayChild.streak_days ?? 0} j.</Text>
            </View>
          </View>

          <View style={warmStyles.xpWrap}>
            <Text style={warmStyles.xpLabel}>Experience · prochain palier dans la serie</Text>
            <View style={warmStyles.xpBarBg}>
              <View style={[warmStyles.xpBarFill, { width: `${xpPct}%` as `${number}%` }]} />
            </View>
            <Text style={[warmStyles.caption, { marginTop: 4 }]}>{xpTotal} XP cumules</Text>
          </View>

          {studentTab === "home" && displayChild && (
            <>
              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Tes passions</Text>
                <Text style={warmStyles.hint}>
                  Choisis ce que tu aimes : les maths, le francais et les autres matieres replacent souvent les exercices dans ce
                  decor (jeux video populaires, sports du moment, musique...).
                </Text>
                <TouchableOpacity
                  style={[warmStyles.pill, { marginTop: 10, alignSelf: "stretch" }]}
                  onPress={() => setInterestCatModalOpen(true)}
                >
                  <Text style={{ fontWeight: "800", color: T.ink }}>
                    1.{" "}
                    {interestCatalog?.categories.find((c) => c.id === interestDraftCategoryId)?.label ||
                      "Domaine (jeux video, sport...)"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    warmStyles.pill,
                    { marginTop: 8, alignSelf: "stretch", opacity: interestDraftCategoryId ? 1 : 0.5 },
                  ]}
                  disabled={!interestDraftCategoryId}
                  onPress={() => interestDraftCategoryId && setInterestFavModalOpen(true)}
                >
                  <Text style={{ fontWeight: "800", color: T.ink }}>
                    2.{" "}
                    {interestOptionsForCategory.find((o) => o.id === interestDraftFavoriteId)?.label ||
                      "Ta passion du moment (liste mise a jour)"}
                  </Text>
                </TouchableOpacity>
                {displayChild.interestTheme && (
                  <Text style={[warmStyles.hint, { marginTop: 10 }]}>
                    Actif : {displayChild.interestTheme.favoriteLabel}
                    {displayChild.interestTheme.blurb ? ` — ${displayChild.interestTheme.blurb}` : ""}
                  </Text>
                )}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[warmStyles.btnSun, { opacity: interestSaving ? 0.6 : 1 }]}
                    onPress={persistStudentInterests}
                    disabled={interestSaving}
                  >
                    <Text style={warmStyles.btnSunText}>{interestSaving ? "..." : "Enregistrer"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[warmStyles.btnOutline, { opacity: interestSaving ? 0.6 : 1 }]}
                    onPress={clearStudentInterests}
                    disabled={interestSaving}
                  >
                    <Text style={warmStyles.btnOutlineText}>Effacer</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Tes niveaux par matiere</Text>
                <Text style={warmStyles.hint}>
                  E = essentiel · M = confort · A = avance. Chaque matiere progressse independamment — comme des badges sur une
                  grande carte de jeux educatifs.
                </Text>
                {activeSubjectsList.map((sub, idx) => {
                  const disp = displayChild.subjectTiersDisplay?.[sub];
                  const tier = disp?.label || "E";
                  const last = idx === activeSubjectsList.length - 1;
                  return (
                    <View
                      key={sub}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 12,
                        borderBottomWidth: last ? 0 : 1,
                        borderBottomColor: T.border,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: T.ink, fontSize: 15, flex: 1, paddingRight: 8 }}>{sub}</Text>
                      <View style={warmStyles.tierBadge}>
                        <Text style={warmStyles.tierText}>
                          {tier} · {displayChild.grade}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <Text style={warmStyles.hint}>Tu es le plus a l'aise en {strongest}.</Text>
                <Text style={warmStyles.hint}>On va surtout t'aider en {weakest}.</Text>
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Ton avatar</Text>
                <Text style={warmStyles.hint}>Choisis une mascotte — elle suit tes progres avec toi.</Text>
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
                        <Text
                          style={{
                            fontWeight: "800",
                            color:
                              (gamification?.avatarId || displayChild.avatar_id || "fox") === a ? T.primaryDark : T.ink,
                          }}
                        >
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
                    <View key={`badge-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
                      <Icon name="medal-outline" size={18} color={T.amber} />
                      <Text style={[warmStyles.hint, { flex: 1 }]}>{b}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={[warmStyles.card, warmStyles.cardLift]}>
                <Text style={warmStyles.sectionTitle}>Quetes du jour</Text>
                {(gamification?.quests || []).map((q) => (
                  <View key={q.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginVertical: 4 }}>
                    <Icon
                      name={q.completed ? "checkbox-marked-circle-outline" : "checkbox-blank-circle-outline"}
                      size={20}
                      color={q.completed ? T.primary : T.inkSubtle}
                    />
                    <Text style={[warmStyles.hint, { flex: 1 }]}>{q.title}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {studentTab === "eval" && displayChild && (
            <>
              <View style={[warmStyles.cardLift, warmStyles.card]}>
                <Text style={warmStyles.sectionTitle}>Evaluations</Text>
                <Text style={warmStyles.hint}>
                  Une serie de questions par matiere. Quand c&apos;est valide, tu vois un badge vert — tu peux refaire pour monter
                  en niveau.
                </Text>
              </View>
              {activeSubjectsList.map((sub) => {
                const done = displayChild.evaluationBySubject?.[sub]?.done;
                return (
                  <View key={`ev-${sub}`} style={[warmStyles.card, warmStyles.cardLift]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontWeight: "900", fontSize: 17, color: T.ink }}>{sub}</Text>
                      {done ? (
                        <View style={[warmStyles.chipGreen, { gap: 6 }]}>
                          <Icon name="check-decagram" size={18} color={T.primaryDark} />
                          <Text style={{ fontWeight: "800", color: T.mintDark }}>Fait</Text>
                        </View>
                      ) : (
                        <Text style={warmStyles.hint}>A faire</Text>
                      )}
                    </View>
                    {evalItem?.subject === sub ? (
                      <>
                        <Text style={warmStyles.hint}>
                          Question {evalItem.index}/{evalItem.total}
                        </Text>
                        <Text style={warmStyles.hint}>{evalItem.prompt}</Text>
                        <TouchableOpacity style={warmStyles.btnSun} onPress={() => speak(evalItem.readAloudText)}>
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
                        <TouchableOpacity style={warmStyles.btnSoft} onPress={() => { setEvalItem(null); setEvalAnswer(""); }}>
                          <Text style={{ color: T.accent, fontWeight: "700" }}>Annuler</Text>
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
                      <Text
                        style={{
                          fontWeight: "800",
                          color: subject === s ? T.primaryDark : T.ink,
                        }}
                      >
                        {s}
                      </Text>
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
                <Text style={warmStyles.sectionTitle}>Ton exercice</Text>
                <Text style={warmStyles.hint}>
                  Etape{" "}
                  {step === "lecture"
                    ? "1 — Lecture"
                    : step === "dictee"
                      ? "2 — Question ou dictee"
                      : step === "correction"
                        ? "3 — Correction"
                        : step === "revision"
                          ? "4 — Revision"
                          : "5 — Bravo"}
                </Text>
                <View style={warmStyles.stepDots}>
                  {(["lecture", "dictee", "correction", "revision", "reward"] as SessionStep[]).map((st, i) => {
                    const order: SessionStep[] = ["lecture", "dictee", "correction", "revision", "reward"];
                    const cur = order.indexOf(step);
                    const active = i <= cur;
                    const current = i === cur;
                    return (
                      <View key={st} style={[warmStyles.stepDot, active ? warmStyles.stepDotOn : undefined, current ? { opacity: 1 } : undefined]} />
                    );
                  })}
                </View>

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
                  <View style={[warmStyles.blockFun, { alignItems: "center" }]}>
                    <LottieLoop source={CELEBRATION_LOTTIE} width={140} height={140} />
                    <Text style={{ fontSize: 22, fontWeight: "900", color: T.primaryDark, marginTop: 4 }}>Bravo !</Text>
                    <Text style={[warmStyles.hint, { textAlign: "center" }]}>Tu gagnes des points et une mini recompense.</Text>
                    <Text style={[warmStyles.hint, { textAlign: "center" }]}>
                      Blague : Pourquoi le livre est fatigue ? Parce qu&apos;il a trop de feuilles !
                    </Text>
                    <TouchableOpacity style={[warmStyles.btnSun, { alignSelf: "stretch", marginTop: 8 }]} onPress={proceedSession}>
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
            style={warmStyles.kidSecondaryBtn}
            onPress={() => {
              if (sessionKind === "student") logoutStudent();
              else setRole("setup");
            }}
          >
            <Text style={{ color: "#5c3d18", fontWeight: "800", fontSize: 15 }}>
              {sessionKind === "student" ? "Quitter mon espace" : "Retour configuration"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
          <StudentBottomNav active={studentTab} onChange={setStudentTab} />
        </View>

        <Modal transparent animationType="fade" visible={interestCatModalOpen} onRequestClose={() => setInterestCatModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Choisis ton domaine</Text>
              <ScrollView style={styles.gradeList} keyboardShouldPersistTaps="handled">
                {(interestCatalog?.categories ?? []).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.gradeRow, interestDraftCategoryId === c.id ? styles.gradeRowActive : undefined]}
                    onPress={() => {
                      setInterestDraftCategoryId(c.id);
                      setInterestDraftFavoriteId("");
                      setInterestCatModalOpen(false);
                      setInterestFavModalOpen(true);
                    }}
                  >
                    <Text style={styles.gradeRowText}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setInterestCatModalOpen(false)}>
                <Text style={styles.btnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal transparent animationType="fade" visible={interestFavModalOpen} onRequestClose={() => setInterestFavModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Ta passion du moment</Text>
              <ScrollView style={styles.gradeList} keyboardShouldPersistTaps="handled">
                {interestOptionsForCategory.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.gradeRow, interestDraftFavoriteId === o.id ? styles.gradeRowActive : undefined]}
                    onPress={() => {
                      setInterestDraftFavoriteId(o.id);
                      setInterestFavModalOpen(false);
                    }}
                  >
                    <Text style={styles.gradeRowText}>{o.label}</Text>
                    {!!o.blurb && (
                      <Text style={[styles.subtitle, { marginTop: 2 }]}>{o.blurb}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setInterestFavModalOpen(false)}>
                <Text style={styles.btnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeInsetView>
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

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  studentBg: { backgroundColor: T.bgDeep },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: "800", color: T.ink },
  studentHeroTitle: { fontSize: 28, color: T.ink },
  landingEmoji: { fontSize: 36, textAlign: "center" },
  subtitle: { fontSize: 14, color: T.inkMuted },
  studentSubtitle: { fontSize: 16, color: T.ink, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginTop: 8, color: T.ink },
  input: {
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    color: T.ink,
  },
  kidInput: { borderWidth: 2, borderColor: T.amberBorder, backgroundColor: T.surface, borderRadius: 14, padding: 14, fontSize: 17 },
  inputLikePicker: {
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  inputLikePickerLabel: { fontSize: 11, color: T.inkSubtle, textTransform: "uppercase", letterSpacing: 0.6 },
  inputLikePickerValue: { fontSize: 17, fontWeight: "700", color: T.ink },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  card: {
    backgroundColor: T.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    gap: 8,
  },
  cardSelected: { borderColor: T.primary, borderWidth: 2 },
  kidCard: { borderRadius: 16, borderColor: T.borderStrong, borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: T.ink },
  block: { backgroundColor: T.surfaceMuted, padding: 12, borderRadius: 14 },
  hint: { color: T.inkMuted, fontSize: 13 },
  errorText: { color: T.danger, fontSize: 13 },
  primaryBtn: {
    backgroundColor: T.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
  },
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
  secondaryBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 6,
  },
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
  btnText: { color: "#fff", fontWeight: "700" },
  btnTextSecondary: { color: T.accent, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: T.overlay,
    justifyContent: "center",
    padding: 20,
  },
  modalSheet: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 18,
    maxHeight: "70%",
    gap: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: T.ink, marginBottom: 4 },
  gradeList: { maxHeight: 320 },
  gradeRow: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  gradeRowActive: { backgroundColor: T.primarySoft },
  gradeRowText: { fontSize: 17, color: T.ink, fontWeight: "600" },
});
