import { analyze, splitSentences, words } from "./analysis";
import type { VoiceCard } from "./types";

const COMMON = new Set(
  "the and a to of in i it he she was that his her you with for on as at my had but not be is they we this from by or an me him them so if then there out up what were when all one into would could said have has no do did are been about just like their its which who will than your our over down back how now more only some any can these those off again here very too own through still even also where after before never every much because while under between before both same each other new old long little good great big small first last next".split(" "),
);

/**
 * A "voice card" is a compact, honest description of how someone writes,
 * computed locally from their own text. The companion is told to write
 * inside it, so suggestions sound like the writer, not like a model.
 */
export function buildVoiceCard(texts: string[]): VoiceCard | null {
  const corpus = texts.join("\n\n").trim();
  const ws = words(corpus);
  if (ws.length < 120) return null;

  const pulse = analyze(corpus);
  const lower = corpus.toLowerCase();
  const perThousand = (n: number) => (n / ws.length) * 1000;

  const first = (lower.match(/\b(i|me|my|we|our)\b/g) ?? []).length;
  const second = (lower.match(/\b(you|your)\b/g) ?? []).length;
  const third = (lower.match(/\b(he|she|they|his|her|their|him)\b/g) ?? []).length;
  const totalP = first + second + third || 1;
  let person: VoiceCard["person"] = "mixed";
  if (first / totalP > 0.55) person = "first";
  else if (second / totalP > 0.45) person = "second";
  else if (third / totalP > 0.55) person = "third";

  const past = (lower.match(/\b\w+ed\b/g) ?? []).length + (lower.match(/\b(was|were|had)\b/g) ?? []).length;
  const present = (lower.match(/\b(is|are|am|has|does)\b/g) ?? []).length + (lower.match(/\b\w+s\b(?=\s+(the|a|an|his|her|their|my|it))/g) ?? []).length;
  let tense: VoiceCard["tense"] = "mixed";
  if (past > present * 1.6) tense = "past";
  else if (present > past * 1.6) tense = "present";

  const freq = new Map<string, number>();
  for (const w of ws) if (!COMMON.has(w) && w.length > 4) freq.set(w, (freq.get(w) ?? 0) + 1);
  const signatureWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);

  const sentences = splitSentences(corpus).filter((s) => s.length > 40 && s.length < 220);
  const step = Math.max(1, Math.floor(sentences.length / 4));
  const sampleSentences = sentences.filter((_, i) => i % step === 0).slice(0, 4);

  return {
    avgSentence: round(pulse.avgSentence),
    sentenceSpread: round(pulse.sentenceSpread),
    vocabRichness: round(pulse.vocabRichness, 2),
    dialogueRatio: round(pulse.dialogueRatio, 2),
    adverbRate: round(pulse.adverbRate),
    emDashRate: round(perThousand((corpus.match(/—|--/g) ?? []).length)),
    semicolonRate: round(perThousand((corpus.match(/;/g) ?? []).length)),
    person,
    tense,
    signatureWords,
    sampleSentences,
    words: ws.length,
  };
}

function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function describeVoice(v: VoiceCard): string[] {
  const out: string[] = [];
  out.push(
    v.avgSentence < 12 ? "Short, punchy sentences" : v.avgSentence < 20 ? "Medium-length sentences" : "Long, flowing sentences",
  );
  out.push(v.sentenceSpread > 9 ? "Wide rhythm: mixes very short and very long" : v.sentenceSpread > 5 ? "Varied rhythm" : "Steady, even rhythm");
  out.push(`${v.person === "mixed" ? "Mixed" : v.person.charAt(0).toUpperCase() + v.person.slice(1)} person, ${v.tense} tense`);
  if (v.dialogueRatio > 0.3) out.push("Dialogue-heavy");
  else if (v.dialogueRatio > 0.1) out.push("Balanced dialogue and narration");
  else out.push("Mostly narration");
  if (v.adverbRate > 4) out.push("Leans on adverbs");
  if (v.emDashRate > 3) out.push("Fond of the em dash");
  if (v.semicolonRate > 2) out.push("Uses semicolons");
  out.push(v.vocabRichness > 0.55 ? "Rich vocabulary" : v.vocabRichness > 0.42 ? "Plain, direct vocabulary" : "Repetitive vocabulary (may be deliberate)");
  return out;
}
