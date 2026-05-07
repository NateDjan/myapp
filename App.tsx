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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, type Child } from "./src/api";

type SessionStep = "lecture" | "dictee" | "correction" | "revision" | "reward";
type Subject = "Francais" | "Maths" | "Histoire";
type AppRole = "landing" | "auth" | "studentAuth" | "setup" | "parent" | "student";

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
  const [subject, setSubject] = useState<Subject>("Francais");
  const [gradePickerOpen, setGradePickerOpen] = useState(false);

  const [newChild, setNewChild] = useState<NewChildDraft>(EMPTY_CHILD_DRAFT);

  const [apiMessage, setApiMessage] = useState("API non testee");
  const [evaluationScore, setEvaluationScore] = useState<number | null>(null);
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
        const parsed = JSON.parse(saved) as { token: string; refreshToken?: string; parentName?: string };
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
          setChildren(kids);
          if (kids.length > 0) setSelectedChildId(kids[0].id);
          setSessionKind("parent");
          setRole("setup");
          await AsyncStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({ token: activeToken, refreshToken: activeRefresh, parentName: parsed.parentName || "" })
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

    const bootstrap = async () => {
      try {
        try {
          await api.health();
          if (!cancelled) setApiMessage("Serveur disponible");
        } catch {
          if (!cancelled) setApiMessage("Serveur indisponible pour le moment");
        }

        await api
          .getCurriculum()
          .then((data) => {
            if (!cancelled) {
              setCurriculumSources(Array.isArray(data.metadata?.sources) ? data.metadata.sources : []);
              setCurriculumNote(typeof data.metadata?.notes === "string" ? data.metadata.notes : "");
            }
          })
          .catch(() => undefined);

        const hasStudent = await tryHydrateStudent();
        if (!hasStudent) await hydrateParentSession();
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
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
    setAuthBusy(true);
    try {
      await AsyncStorage.removeItem(STUDENT_STORAGE_KEY);
      if (authMode === "register") {
        await api.registerParent({ name: parentName || "Parent", email: email.trim(), password });
      }
      const logged = await api.loginParent({ email: email.trim(), password });
      const access = logged.token || logged.accessToken || "";
      const rt = logged.refreshToken || "";
      setToken(access);
      setRefreshToken(rt);
      setParentName(logged.parent.name);
      setSessionKind("parent");
      setRole("setup");
      const kids = await api.getChildren(access);
      setChildren(kids);
      if (kids.length > 0) setSelectedChildId(kids[0].id);
      await AsyncStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: access, refreshToken: rt, parentName: logged.parent.name })
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

  const runEvaluation = async () => {
    if (!token || !selectedChild) return;
    setErrorMessage("");
    try {
      const result = await api.evaluateChild(token, selectedChild.id);
      setEvaluationScore(result.score);
      await reloadChildren();
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const loadLesson = async () => {
    if (!token || !selectedChild) return;
    try {
      const result = await api.getLesson(token, selectedChild.id, subject);
      setLessonPrompt(result.lesson?.prompt || "Aucun contenu disponible.");
      setDictationPrompt(result.dictation?.prompt || "");
      setDictationExpected(result.dictation?.expected || "");
      setReviewItemId(result.review?.id || null);
      setReviewPhrase(result.review?.phrase || "");
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  useEffect(() => {
    loadLesson();
  }, [subject, selectedChildId]);

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
        });
        setSessionFeedback(result.feedback);
        await reloadChildren();
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

  if (role === "landing") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>EduCoach FR</Text>
          <Text style={styles.landingEmoji}>📚✨</Text>
          <Text style={styles.subtitle}>{apiMessage}</Text>
          {sessionLoading && <Text style={styles.hint}>Chargement...</Text>}
          <Text style={styles.sectionTitle}>Qui utilise l&apos;application ?</Text>
          <Text style={styles.hint}>
            Les parents creent le profil de l&apos;enfant et choisissent son identifiant et son mot de passe. L&apos;enfant se connecte avec ces informations sans voir l&apos;espace parent.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setRole("auth")}>
            <Text style={styles.btnText}>Parents et tuteurs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.kidPrimaryBtn} onPress={() => setRole("studentAuth")}>
            <Text style={styles.kidBtnText}>Je suis eleve</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "studentAuth") {
    return (
      <SafeAreaView style={[styles.container, styles.studentBg]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[styles.title, styles.studentHeroTitle]}>Salut champion !</Text>
          <Text style={styles.subtitle}>{apiMessage}</Text>

          <Text style={styles.sectionTitle}>Ta connexion</Text>
          <Text style={styles.hint}>Demande a tes parents ton identifiant et ton mot de passe.</Text>
          <TextInput
            style={styles.kidInput}
            placeholder="Identifiant"
            autoCapitalize="none"
            autoCorrect={false}
            value={kidLoginId}
            onChangeText={setKidLoginId}
          />
          <TextInput
            style={styles.kidInput}
            placeholder="Mot de passe"
            secureTextEntry
            value={kidPassword}
            onChangeText={setKidPassword}
          />

          <TouchableOpacity style={styles.kidPrimaryBtn} onPress={runKidAuth} disabled={authBusy}>
            {authBusy ? <ActivityIndicator color="#3d3d3d" /> : <Text style={styles.kidBtnText}>C&apos;est parti !</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("landing")}>
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "auth") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>Espace parents</Text>
          <Text style={styles.subtitle}>{apiMessage}</Text>
          {sessionLoading && <Text style={styles.hint}>Restauration de session en cours...</Text>}

          <Text style={styles.sectionTitle}>Connexion parent / tuteur</Text>

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
            <TextInput
              style={styles.input}
              placeholder="Nom parent"
              value={parentName}
              onChangeText={setParentName}
            />
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
      <SafeAreaView style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>Configuration</Text>
          <Text style={styles.subtitle}>Parent: {parentName}</Text>

          <Text style={styles.sectionTitle}>Ajouter un profil enfant</Text>
          <Text style={styles.hint}>Choisis la classe sur la liste (du CP a la Terminale). Tu definis l&apos;identifiant et le mot de passe pour cet enfant.</Text>
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
          <TextInput style={styles.input} placeholder="Points forts" value={newChild.strengths} onChangeText={(v) => setNewChild((p) => ({ ...p, strengths: v }))} />
          <TextInput style={styles.input} placeholder="Points faibles" value={newChild.weaknesses} onChangeText={(v) => setNewChild((p) => ({ ...p, weaknesses: v }))} />

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
      <SafeAreaView style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>Espace Parent</Text>
          <Text style={styles.subtitle}>Suivi multi-enfants et devoirs</Text>

          {dashboard.map((item) => (
            <View key={item.childId} style={styles.card}>
              <Text style={styles.cardTitle}>{item.childName}</Text>
              <Text>Niveau lecture: {item.readingLevel}/3</Text>
              <Text>Niveau orthographe: {item.spellingLevel}/3</Text>
              <Text>Points: {item.points}</Text>
              <Text>Revisions en attente: {item.pendingReviews}</Text>
            </View>
          ))}

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

  const kidUi = sessionKind === "student";

  return (
    <SafeAreaView style={[styles.container, kidUi ? styles.studentBg : undefined]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={[styles.title, kidUi ? styles.studentHeroTitle : undefined]}>{kidUi ? "Ton espace jeu" : "Espace Eleve"}</Text>
        {!selectedChild ? (
          <Text>Selectionner un enfant depuis la configuration.</Text>
        ) : (
          <>
            <Text style={[styles.subtitle, kidUi ? styles.studentSubtitle : undefined]}>
              {kidUi ? `Coucou ${selectedChild.first_name} ! ` : `${selectedChild.first_name} — `}
              Points {selectedChild.points}
            </Text>

            <View style={styles.row}>
              {(["Francais", "Maths", "Histoire"] as Subject[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[kidUi ? styles.kidSubjectBtn : styles.subjectBtn, subject === s ? styles.subjectBtnActive : undefined]}
                  onPress={() => setSubject(s)}
                >
                  <Text style={styles.btnText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.card, kidUi ? styles.kidCard : undefined]}>
              <Text style={styles.cardTitle}>Evaluation initiale (moins de 10 minutes)</Text>
              <Text>Resultat: {evaluationScore === null ? "Non lancee" : `${evaluationScore}/100`}</Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={runEvaluation}>
                <Text style={styles.btnText}>Lancer</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, kidUi ? styles.kidCard : undefined]}>
              <Text style={styles.cardTitle}>Programme court (10 minutes max)</Text>
              <Text>Etape: {step.toUpperCase()}</Text>

              {step === "lecture" && <Text style={styles.block}>{lessonPrompt}</Text>}
              {step === "dictee" && (
                <>
                  <Text style={styles.block}>{dictationPrompt || "Quiz oral de la matiere en cours"}</Text>
                  {subject === "Francais" && (
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={dictationInput}
                      onChangeText={setDictationInput}
                      multiline
                      placeholder="Ecris la phrase ici"
                    />
                  )}
                </>
              )}

              {step === "correction" && <Text style={styles.block}>{sessionFeedback || "Corrige puis reecris."}</Text>}

              {step === "revision" && (
                <Text style={styles.block}>
                  Revision espacee: {reviewPhrase || "Aucune phrase en retard, bravo."}
                </Text>
              )}

              {step === "reward" && (
                <View>
                  <Text style={styles.block}>Recompense: points + carte fun + blague.</Text>
                  <Text style={styles.hint}>Blague: Pourquoi le stylo chante faux ? Parce qu'il manque de notes !</Text>
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={proceedSession}>
                <Text style={styles.btnText}>Continuer</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, kidUi ? styles.kidCard : undefined]}>
              <Text style={styles.cardTitle}>Programme conseille pour {selectedChild.grade}</Text>
              {recommendations
                .filter((r) => r.subject === subject)
                .flatMap((r) => r.microLessons || [])
                .slice(0, 3)
                .map((lesson: any, idx: number) => (
                  <Text key={`lesson-${idx}`}>- {lesson.title} ({lesson.durationMin} min)</Text>
                ))}
            </View>
          </>
        )}

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {(curriculumSources?.length ?? 0) > 0 && (
          <View style={[styles.card, kidUi ? styles.kidCard : undefined]}>
            <Text style={styles.cardTitle}>Sources pedagogiques en ligne</Text>
            {(curriculumSources ?? []).slice(0, 4).map((src, idx) => (
              <Text style={styles.hint} key={`src-${idx}`}>{src}</Text>
            ))}
          </View>
        )}
        {sessionKind === "parent" ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("setup")}>
              <Text style={styles.btnText}>Changer d&apos;enfant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("parent")}>
              <Text style={styles.btnText}>Vue parent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={logout}>
              <Text style={styles.btnText}>Deconnexion parent</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={kidUi ? styles.kidSecondaryBtn : styles.secondaryBtn} onPress={logoutStudent}>
            <Text style={kidUi ? styles.kidBtnDarkText : styles.btnText}>Quitter mon espace</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
