import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type ChildProfile = {
  id: string;
  firstName: string;
  grade: string;
  age: string;
  strengths: string;
  weaknesses: string;
  points: number;
  readingLevel: number;
  spellingLevel: number;
  historyLevel: number;
  mathLevel: number;
  mistakesToReview: string[];
};

type SessionStep = "lecture" | "dictee" | "correction" | "revision" | "reward";
type Subject = "Francais" | "Maths" | "Histoire";

const readingTexts = [
  "Lina adore lire des histoires courtes chaque soir.",
  "Le petit explorateur observe les etoiles dans le ciel sombre.",
  "Pendant les vacances, la classe visite un musee sur la Revolution francaise.",
];

const dictationItems = [
  {
    prompt: "Ecris: Les enfants jouent dans la cour de l'ecole.",
    expected: "Les enfants jouent dans la cour de l'ecole.",
  },
  {
    prompt: "Ecris: Nous avons termine nos devoirs de mathematiques.",
    expected: "Nous avons termine nos devoirs de mathematiques.",
  },
  {
    prompt: "Ecris: Mon frere raconte une histoire interessante.",
    expected: "Mon frere raconte une histoire interessante.",
  },
];

function scoreAnswer(answer: string, expected: string) {
  if (answer.trim() === expected.trim()) return 100;
  const normalizedA = answer.trim().toLowerCase();
  const normalizedE = expected.trim().toLowerCase();
  let same = 0;
  for (let i = 0; i < Math.min(normalizedA.length, normalizedE.length); i += 1) {
    if (normalizedA[i] === normalizedE[i]) same += 1;
  }
  return Math.max(0, Math.round((same / normalizedE.length) * 100));
}

export default function App() {
  const [parentName, setParentName] = useState("");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [role, setRole] = useState<"setup" | "parent" | "student">("setup");
  const [newChild, setNewChild] = useState<
    Omit<
      ChildProfile,
      | "id"
      | "points"
      | "readingLevel"
      | "spellingLevel"
      | "historyLevel"
      | "mathLevel"
      | "mistakesToReview"
    >
  >({
    firstName: "",
    grade: "",
    age: "",
    strengths: "",
    weaknesses: "",
  });

  const [subject, setSubject] = useState<Subject>("Francais");
  const [isEvaluationDone, setIsEvaluationDone] = useState(false);
  const [evaluationScore, setEvaluationScore] = useState(0);
  const [step, setStep] = useState<SessionStep>("lecture");
  const [dictationInput, setDictationInput] = useState("");
  const [sessionFeedback, setSessionFeedback] = useState("");

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  );

  const createChild = () => {
    if (!newChild.firstName || !newChild.grade) return;
    const child: ChildProfile = {
      id: String(Date.now()),
      ...newChild,
      points: 10,
      readingLevel: 1,
      spellingLevel: 1,
      historyLevel: 1,
      mathLevel: 1,
      mistakesToReview: [],
    };
    setChildren((prev) => [...prev, child]);
    setSelectedChildId(child.id);
    setNewChild({
      firstName: "",
      grade: "",
      age: "",
      strengths: "",
      weaknesses: "",
    });
  };

  const updateChild = (updater: (child: ChildProfile) => ChildProfile) => {
    if (!selectedChild) return;
    setChildren((prev) =>
      prev.map((c) => (c.id === selectedChild.id ? updater(c) : c))
    );
  };

  const runEvaluation = () => {
    if (!selectedChild) return;
    const base = Number(selectedChild.age) > 10 ? 65 : 52;
    const booster = selectedChild.strengths.toLowerCase().includes("lecture")
      ? 12
      : 0;
    const score = Math.min(95, base + booster);
    setEvaluationScore(score);
    setIsEvaluationDone(true);
    updateChild((c) => ({
      ...c,
      readingLevel: score > 80 ? 3 : score > 60 ? 2 : 1,
      spellingLevel: score > 75 ? 3 : score > 55 ? 2 : 1,
    }));
  };

  const proceedSession = () => {
    if (!selectedChild) return;

    if (step === "lecture") {
      setStep("dictee");
      return;
    }

    if (step === "dictee") {
      const current =
        dictationItems[(selectedChild.spellingLevel - 1) % dictationItems.length];
      const score = scoreAnswer(dictationInput, current.expected);
      const hasMistake = score < 100;

      updateChild((c) => ({
        ...c,
        points: c.points + (score > 80 ? 20 : 10),
        mistakesToReview: hasMistake
          ? [...c.mistakesToReview, current.expected]
          : c.mistakesToReview,
      }));

      setSessionFeedback(
        score === 100
          ? "Excellent, aucune faute."
          : `Score ${score}/100. Corrige puis reecris la phrase.`
      );
      setStep("correction");
      return;
    }

    if (step === "correction") {
      setStep("revision");
      return;
    }

    if (step === "revision") {
      updateChild((c) => ({ ...c, points: c.points + 15 }));
      setStep("reward");
      return;
    }

    if (step === "reward") {
      setStep("lecture");
      setDictationInput("");
      setSessionFeedback("");
      updateChild((c) => ({ ...c, points: c.points + 5 }));
    }
  };

  if (role === "setup") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>EduCoach FR</Text>
          <Text style={styles.subtitle}>
            App smartphone pour progresser en 10 minutes
          </Text>

          <Text style={styles.sectionTitle}>Compte parent/tuteur</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom du parent"
            value={parentName}
            onChangeText={setParentName}
          />

          <Text style={styles.sectionTitle}>Ajouter un profil enfant</Text>
          <TextInput
            style={styles.input}
            placeholder="Prenom"
            value={newChild.firstName}
            onChangeText={(v) => setNewChild((p) => ({ ...p, firstName: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Classe (ex: CE2)"
            value={newChild.grade}
            onChangeText={(v) => setNewChild((p) => ({ ...p, grade: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Age"
            value={newChild.age}
            onChangeText={(v) => setNewChild((p) => ({ ...p, age: v }))}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Points forts"
            value={newChild.strengths}
            onChangeText={(v) => setNewChild((p) => ({ ...p, strengths: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Points faibles"
            value={newChild.weaknesses}
            onChangeText={(v) => setNewChild((p) => ({ ...p, weaknesses: v }))}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={createChild}>
            <Text style={styles.btnText}>Ajouter l'enfant</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Profils enregistres</Text>
          {children.map((child) => (
            <TouchableOpacity
              key={child.id}
              style={styles.card}
              onPress={() => setSelectedChildId(child.id)}
            >
              <Text style={styles.cardTitle}>
                {child.firstName} - {child.grade}
              </Text>
              <Text>Points: {child.points}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setRole("parent")}
            >
              <Text style={styles.btnText}>Vue Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setRole("student")}
            >
              <Text style={styles.btnText}>Vue Eleve</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "parent") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Espace Parent</Text>
          <Text style={styles.subtitle}>
            Tuteur: {parentName || "Non renseigne"}
          </Text>

          {children.map((child) => (
            <View key={child.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {child.firstName} ({child.grade})
              </Text>
              <Text>Age: {child.age}</Text>
              <Text>Niveau lecture: {child.readingLevel}/3</Text>
              <Text>Niveau orthographe: {child.spellingLevel}/3</Text>
              <Text>Points accumules: {child.points}</Text>
              <Text>Erreurs a revoir: {child.mistakesToReview.length}</Text>
              <Text style={styles.hint}>
                Connexion Pronote: mode demo (a integrer avec API officielle)
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setRole("setup")}
          >
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const readingText = selectedChild
    ? readingTexts[(selectedChild.readingLevel - 1) % readingTexts.length]
    : readingTexts[0];
  const dictation = selectedChild
    ? dictationItems[(selectedChild.spellingLevel - 1) % dictationItems.length]
    : dictationItems[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Espace Eleve</Text>
        {!selectedChild ? (
          <Text>Ajoute ou selectionne un profil depuis l'ecran principal.</Text>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {selectedChild.firstName} - Points {selectedChild.points}
            </Text>

            <View style={styles.row}>
              {(["Francais", "Maths", "Histoire"] as Subject[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.subjectBtn,
                    subject === s ? styles.subjectBtnActive : undefined,
                  ]}
                  onPress={() => setSubject(s)}
                >
                  <Text style={styles.btnText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Evaluation initiale (moins de 10 minutes)
              </Text>
              <Text>
                Resultat: {isEvaluationDone ? `${evaluationScore}/100` : "Non demarree"}
              </Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={runEvaluation}>
                <Text style={styles.btnText}>Lancer l'evaluation</Text>
              </TouchableOpacity>
            </View>

            {subject === "Francais" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Programme court (10 minutes max)</Text>
                <Text>Etape actuelle: {step.toUpperCase()}</Text>

                {step === "lecture" && <Text style={styles.block}>{readingText}</Text>}

                {step === "dictee" && (
                  <>
                    <Text style={styles.block}>{dictation.prompt}</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={dictationInput}
                      onChangeText={setDictationInput}
                      multiline
                      placeholder="Ecris la phrase ici"
                    />
                  </>
                )}

                {step === "correction" && (
                  <>
                    <Text style={styles.block}>
                      {sessionFeedback || "Corrige la phrase puis reecris-la."}
                    </Text>
                    <Text style={styles.hint}>
                      Correction attendue: {dictation.expected}
                    </Text>
                  </>
                )}

                {step === "revision" && (
                  <>
                    <Text style={styles.block}>
                      Revision espacee: reecris une phrase deja corrigee.
                    </Text>
                    <Text style={styles.hint}>
                      Phrase revue: {selectedChild.mistakesToReview[selectedChild.mistakesToReview.length - 1] || dictation.expected}
                    </Text>
                  </>
                )}

                {step === "reward" && (
                  <>
                    <Text style={styles.block}>
                      Bravo! Tu as termine le programme court.
                    </Text>
                    <Text style={styles.hint}>
                      Recompense: +20 points, image fun et blague du jour.
                    </Text>
                    <Text style={styles.hint}>
                      Blague: Pourquoi le cahier est content? Parce qu'il est bien note!
                    </Text>
                  </>
                )}

                <TouchableOpacity style={styles.primaryBtn} onPress={proceedSession}>
                  <Text style={styles.btnText}>Continuer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Mode {subject}</Text>
                <Text style={styles.block}>
                  Module adaptatif de {subject} en cours (structure prete).
                </Text>
                <Text style={styles.hint}>
                  Prochaine etape: banque d'exercices alignes programme francais.
                </Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRole("setup")}>
          <Text style={styles.btnText}>Retour</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#d4daf0",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 10,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbe0f5",
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  block: { backgroundColor: "#f0f4ff", padding: 10, borderRadius: 8 },
  hint: { color: "#59638f", fontSize: 12 },
  primaryBtn: {
    backgroundColor: "#4152c9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  secondaryBtn: {
    backgroundColor: "#6878e6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 6,
  },
  subjectBtn: {
    backgroundColor: "#95a1e6",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  subjectBtnActive: { backgroundColor: "#4152c9" },
  btnText: { color: "white", fontWeight: "700" },
});
