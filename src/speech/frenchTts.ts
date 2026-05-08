import * as Speech from "expo-speech";
import { Platform } from "react-native";

let preferredVoice: string | undefined;
let warming = false;

/** Prefetch meilleure voix francaise disponible (sinon defaut systeme). */
export async function warmFrenchVoice(): Promise<void> {
  if (warming) return;
  warming = true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const fr = voices.filter((v) => v.language && v.language.toLowerCase().startsWith("fr"));
    const rank = (id: string, name: string) => {
      const n = `${id} ${name}`.toLowerCase();
      let s = 0;
      if (n.includes("premium") || n.includes("enhanced") || n.includes("neural")) s += 6;
      if (n.includes("amelie") || n.includes("thomas") || n.includes("audrey") || n.includes("virginie")) s += 4;
      if (n.includes("fr-fr") || n.includes("fr-france")) s += 1;
      return s;
    };
    let best = fr[0];
    for (const v of fr) {
      const bid = String(v.identifier || "");
      const bnm = String(v.name || "");
      if (!best || rank(bid, bnm) > rank(String(best.identifier || ""), String(best.name || ""))) best = v;
    }
    if (best?.identifier) preferredVoice = best.identifier;
  } catch {
    preferredVoice = undefined;
  } finally {
    warming = false;
  }
}

function baseOptions(): Speech.SpeechOptions {
  const rate = Platform.OS === "ios" ? 0.44 : Platform.OS === "android" ? 0.95 : 0.95;
  const pitch = Platform.OS === "ios" ? 1.02 : 1.0;
  const opts: Speech.SpeechOptions = { language: "fr-FR", rate, pitch };
  if (preferredVoice) opts.voice = preferredVoice;
  return opts;
}

/** Lecture une fois — bon pour phrases courtes. */
export function speakFrench(text: string): void {
  const t = String(text || "").trim();
  if (!t) return;
  Speech.stop();
  void warmFrenchVoice().then(() => {
    Speech.speak(t, baseOptions());
  });
}

/** Decoupe par phrases pour limiter l’effet « robot » sur textes longs. */
export function speakFrenchChunked(text: string): void {
  const t = String(text || "").trim();
  if (!t) return;
  Speech.stop();
  const rawParts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks = rawParts.length > 1 ? rawParts : [t];
  let i = 0;
  const step = () => {
    if (i >= chunks.length) return;
    const chunk = chunks[i];
    i += 1;
    void warmFrenchVoice().then(() => {
      const opts = baseOptions();
      opts.onDone = () => {
        setTimeout(step, Platform.OS === "web" ? 120 : 260);
      };
      Speech.speak(chunk, opts);
    });
  };
  step();
}
