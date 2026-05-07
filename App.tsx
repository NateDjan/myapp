import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
const SESSION_STORAGE_KEY = "educoach.session.v1";

export default function App() {
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [role, setRole] = useState<"auth" | "setup" | "parent" | "student">("auth");
  const [subject, setSubject] = useState<Subject>("Francais");

  const [newChild, setNewChild] = useState({
    firstName: "",
    grade: "",
    age: "",
    strengths: "",
    weaknesses: "",
  });

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

    const hydrateSession = async () => {
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
              setCurriculumSources(data.metadata.sources);
              setCurriculumNote(data.metadata.notes);
            }
          })
          .catch(() => undefined);

        await hydrateSession();
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
      if (authMode === "register") {
        await api.registerParent({ name: parentName || "Parent", email: email.trim(), password });
      }
      const logged = await api.loginParent({ email: email.trim(), password });
      const access = logged.token || logged.accessToken || "";
      const rt = logged.refreshToken || "";
      setToken(access);
      setRefreshToken(rt);
      setParentName(logged.parent.name);
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

  const logout = async () => {
    try {
      if (token) await api.logoutParent(token);
    } catch {
      // ignore logout API errors and clear local session anyway
    }
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    setToken("");
    setRefreshToken("");
    setChildren([]);
    setSelectedChildId(null);
    setRole("auth");
  };

  const reloadChildren = async () => {
    if (!token) return;
    const kids = await api.getChildren(token);
    setChildren(kids);
    if (!selectedChildId && kids.length > 0) setSelectedChildId(kids[0].id);
  };

  const createChild = async () => {
    if (!token || !newChild.firstName || !newChild.grade || !newChild.age) return;
    setErrorMessage("");
    try {
      await api.createChild(token, {
        firstName: newChild.firstName,
        grade: newChild.grade,
        age: Number(newChild.age),
        strengths: newChild.strengths,
        weaknesses: newChild.weaknesses,
      });
      setNewChild({ firstName: "", grade: "", age: "", strengths: "", weaknesses: "" });
      await reloadChildren();
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
      setRecommendations(result.recommendations);
      setCurriculumSources(result.sources);
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

  if (role === "auth") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>EduCoach FR</Text>
          <Text style={styles.subtitle}>{apiMessage}</Text>
          {sessionLoading && <Text style={styles.hint}>Restauration de session en cours...</Text>}

          <Text style={styles.sectionTitle}>Authentification parent/tuteur</Text>

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
          <TextInput style={styles.input} placeholder="Prenom" value={newChild.firstName} onChangeText={(v) => setNewChild((p) => ({ ...p, firstName: v }))} />
          <TextInput style={styles.input} placeholder="Classe" value={newChild.grade} onChangeText={(v) => setNewChild((p) => ({ ...p, grade: v }))} />
          <TextInput style={styles.input} placeholder="Age" value={newChild.age} onChangeText={(v) => setNewChild((p) => ({ ...p, age: v }))} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Points forts" value={newChild.strengths} onChangeText={(v) => setNewChild((p) => ({ ...p, strengths: v }))} />
          <TextInput style={styles.input} placeholder="Points faibles" value={newChild.weaknesses} onChangeText={(v) => setNewChild((p) => ({ ...p, weaknesses: v }))} />

          <TouchableOpacity style={styles.primaryBtn} onPress={createChild}>
            <Text style={styles.btnText}>Ajouter l'enfant</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Enfants</Text>
          {children.map((child) => (
            <TouchableOpacity key={child.id} style={styles.card} onPress={() => setSelectedChildId(child.id)}>
              <Text style={styles.cardTitle}>{child.first_name} - {child.grade}</Text>
              <Text>Points: {child.points}</Text>
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
          {recommendations.map((rec, idx) => (
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>Espace Eleve</Text>
        {!selectedChild ? (
          <Text>Selectionner un enfant depuis la configuration.</Text>
        ) : (
          <>
            <Text style={styles.subtitle}>{selectedChild.first_name} - Points {selectedChild.points}</Text>

            <View style={styles.row}>
              {(["Francais", "Maths", "Histoire"] as Subject[]).map((s) => (
                <TouchableOpacity key={s} style={[styles.subjectBtn, subject === s ? styles.subjectBtnActive : undefined]} onPress={() => setSubject(s)}>
                  <Text style={styles.btnText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Evaluation initiale (moins de 10 minutes)</Text>
              <Text>Resultat: {evaluationScore === null ? "Non lancee" : `${evaluationScore}/100`}</Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={runEvaluation}>
                <Text style={styles.btnText}>Lancer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
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

            <View style={styles.card}>
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
        {curriculumSources.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sources pedagogiques en ligne</Text>
            {curriculumSources.slice(0, 4).map((src, idx) => (
              <Text style={styles.hint} key={`src-${idx}`}>{src}</Text>
            ))}
          </View>
        )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#1d2b64" },
  subtitle: { fontSize: 14, color: "#4c5c96" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#d4daf0", backgroundColor: "white", borderRadius: 10, padding: 10 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  card: { backgroundColor: "white", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#dbe0f5", gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  block: { backgroundColor: "#f0f4ff", padding: 10, borderRadius: 8 },
  hint: { color: "#59638f", fontSize: 12 },
  errorText: { color: "#b01919", fontSize: 12 },
  primaryBtn: { backgroundColor: "#4152c9", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  secondaryBtn: { backgroundColor: "#6878e6", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", marginTop: 6 },
  subjectBtn: { backgroundColor: "#95a1e6", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  subjectBtnActive: { backgroundColor: "#4152c9" },
  btnText: { color: "white", fontWeight: "700" },
});
