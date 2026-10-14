/**
 * Local, instant text analysis. Nothing here touches the network.
 * Heuristic by design: good enough to show a writer where to look.
 */

export interface ParagraphPulse {
  index: number;
  words: number;
  tension: number; // 0..1
  sentiment: number; // -1..1
  dialogue: number; // 0..1 share of dialogue
  avgSentence: number;
  preview: string;
}

export interface Pulse {
  words: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  avgSentence: number;
  sentenceSpread: number; // std dev of sentence length
  longestSentence: number;
  flesch: number; // 0..100
  grade: number;
  dialogueRatio: number;
  adverbRate: number; // per 100 words
  passiveRate: number; // per 100 sentences
  fillerRate: number; // per 100 words
  vocabRichness: number; // type/token ratio on first 1000 words
  repeats: { word: string; count: number }[];
  cliches: string[];
  weakVerbs: number;
  sensory: Record<"sight" | "sound" | "smell" | "touch" | "taste", number>;
  paragraphsPulse: ParagraphPulse[];
  syllablesPerLine: number[];
  rhymeScheme: string;
  lineEndings: string[];
}

const FILLERS = [
  "very", "really", "just", "quite", "rather", "somewhat", "basically", "actually", "literally",
  "kind of", "sort of", "a bit", "in order to", "the fact that", "definitely", "totally", "simply",
];

const CLICHES = [
  "at the end of the day", "in the nick of time", "a chill ran down", "heart skipped a beat",
  "blood ran cold", "time stood still", "deafening silence", "crystal clear", "only time will tell",
  "little did", "in this day and age", "think outside the box", "dead as a doornail", "avoid like the plague",
  "last but not least", "the calm before the storm", "every cloud has a silver lining", "let out a breath",
  "breath she didn't know", "breath he didn't know", "orbs", "piercing blue eyes", "released the breath",
  "tears streamed down", "a single tear", "eyes widened", "let out a sigh", "in the blink of an eye",
];

const WEAK_VERBS = ["was", "were", "is", "are", "be", "been", "being", "had", "has", "have", "got", "get", "went", "came", "made", "seemed", "felt", "looked", "began to", "started to"];

const TENSION_WORDS = [
  "blood", "scream", "knife", "gun", "run", "ran", "dark", "death", "dead", "die", "fear", "afraid", "terror",
  "shatter", "crash", "fire", "burn", "cold", "silence", "suddenly", "no", "never", "stop", "wait", "help",
  "fight", "hit", "struck", "fall", "fell", "danger", "threat", "trap", "lock", "hunt", "chase", "bleed",
  "shadow", "whisper", "alone", "lost", "break", "broke", "crack", "storm", "thunder", "war", "kill", "hurt",
  "pain", "gasp", "shook", "trembl", "grip", "clutch", "tight", "urgent", "now",
];

const POSITIVE = ["love", "warm", "laugh", "smile", "bright", "gentle", "soft", "hope", "safe", "joy", "kind", "sweet", "calm", "light", "home", "glad", "beautiful", "peace", "delight", "tender"];
const NEGATIVE = ["hate", "cold", "cry", "dark", "cruel", "grief", "loss", "fear", "pain", "dead", "ache", "bitter", "alone", "wound", "sick", "rot", "empty", "hollow", "ruin", "regret"];

const SENSORY: Record<"sight" | "sound" | "smell" | "touch" | "taste", string[]> = {
  sight: ["saw", "see", "glint", "glow", "shade", "shadow", "bright", "dim", "color", "colour", "red", "blue", "green", "gold", "pale", "gleam", "flicker", "shimmer", "light", "dark", "shape", "watched", "stared"],
  sound: ["heard", "hear", "hum", "roar", "whisper", "creak", "crack", "echo", "silence", "ring", "buzz", "murmur", "rustle", "thud", "click", "voice", "song", "quiet", "loud", "hiss"],
  smell: ["smell", "scent", "stink", "reek", "aroma", "perfume", "smoke", "musk", "fragrance", "odor", "odour", "sniffed", "whiff"],
  touch: ["touch", "rough", "smooth", "cold", "warm", "heat", "wet", "damp", "dry", "soft", "sharp", "grit", "sticky", "silk", "skin", "pressed", "brushed", "grip"],
  taste: ["taste", "sweet", "sour", "bitter", "salt", "salty", "tang", "spice", "sugar", "honey", "ate", "drank", "sip", "bite"],
};

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…]["'”’)\]]?)\s+(?=[A-Z"'“‘(\[])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
}

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z’']+/g) ?? []).map((w) => w.replace(/^['’]+|['’]+$/g, "")).filter(Boolean);
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let s = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g)?.length ?? 1;
  if (w.endsWith("le") && w.length > 2 && !/[aeiouy]/.test(w[w.length - 3])) s += 1;
  return Math.max(1, s);
}

function std(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length);
}

function dialogueShare(text: string): number {
  const quoted = text.match(/["“][^"”]{2,}["”]/g) ?? [];
  const q = quoted.reduce((n, s) => n + s.split(/\s+/).length, 0);
  const total = Math.max(1, text.split(/\s+/).length);
  return Math.min(1, q / total);
}

function rhymeKey(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return "";
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  return m ? m[0] : w.slice(-2);
}

function detectRhymeScheme(lines: string[]): string {
  if (lines.length < 2) return "";
  const keys = lines.map((l) => {
    const ws = l.trim().split(/\s+/);
    return rhymeKey(ws[ws.length - 1] ?? "");
  });
  const letters: string[] = [];
  const map = new Map<string, string>();
  let next = 65;
  for (const k of keys) {
    if (!k) {
      letters.push("-");
      continue;
    }
    if (!map.has(k)) map.set(k, String.fromCharCode(next++));
    letters.push(map.get(k)!);
  }
  return letters.slice(0, 16).join("");
}

export function analyze(text: string, isVerse = false): Pulse {
  const clean = text.replace(/\r/g, "");
  const ws = words(clean);
  const wordCount = ws.length;
  const sentences = isVerse ? clean.split(/\n/).filter((l) => l.trim()) : splitSentences(clean);
  const sentLens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
  const paragraphs = splitParagraphs(clean);
  const syllables = ws.reduce((n, w) => n + countSyllables(w), 0);
  const avgSentence = sentLens.length ? wordCount / sentLens.length : 0;
  const flesch = wordCount
    ? Math.max(0, Math.min(100, 206.835 - 1.015 * avgSentence - 84.6 * (syllables / wordCount)))
    : 0;
  const grade = wordCount ? Math.max(0, 0.39 * avgSentence + 11.8 * (syllables / wordCount) - 15.59) : 0;

  const lower = clean.toLowerCase();
  const adverbs = ws.filter((w) => w.length > 4 && w.endsWith("ly") && !["only", "family", "early", "reply", "apply", "supply", "belly", "jelly", "holy", "ugly", "fly", "rely"].includes(w)).length;
  const passive = (lower.match(/\b(was|were|is|are|been|being|be)\s+(\w+ed|\w+en)\b/g) ?? []).length;
  const filler = FILLERS.reduce((n, f) => n + (lower.match(new RegExp(`\\b${f}\\b`, "g"))?.length ?? 0), 0);
  const cliches = CLICHES.filter((c) => lower.includes(c));
  const weak = WEAK_VERBS.reduce((n, v) => n + (lower.match(new RegExp(`\\b${v}\\b`, "g"))?.length ?? 0), 0);

  const freq = new Map<string, number>();
  const STOP = new Set(["the", "and", "a", "to", "of", "in", "i", "it", "he", "she", "was", "that", "his", "her", "you", "with", "for", "on", "as", "at", "my", "had", "but", "not", "be", "is", "they", "we", "this", "from", "by", "or", "an", "me", "him", "them", "so", "if", "then", "there", "out", "up", "what", "were", "when", "all", "one", "into", "would", "could", "said", "have", "has", "no", "do", "did", "are", "been", "about", "just", "like", "their", "its", "which", "who", "will", "than", "your", "our", "over", "down", "back", "how", "now", "more", "only", "some", "any", "can", "these", "those", "off", "again", "here", "very", "too", "own", "too", "through", "still", "even", "also"]);
  for (const w of ws) if (!STOP.has(w) && w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1);
  const repeats = [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  const firstK = ws.slice(0, 1000);
  const vocabRichness = firstK.length ? new Set(firstK).size / firstK.length : 0;

  const sensory = Object.fromEntries(
    Object.entries(SENSORY).map(([k, list]) => [k, list.reduce((n, w) => n + (lower.match(new RegExp(`\\b${w}\\w*\\b`, "g"))?.length ?? 0), 0)]),
  ) as Pulse["sensory"];

  const paragraphsPulse: ParagraphPulse[] = paragraphs.map((p, index) => {
    const pw = words(p);
    const pl = p.toLowerCase();
    const sl = splitSentences(p).map((s) => s.split(/\s+/).length);
    const avg = sl.length ? pw.length / sl.length : pw.length;
    const excl = (p.match(/[!?]/g) ?? []).length;
    const tensionHits = TENSION_WORDS.reduce((n, w) => n + (pl.includes(w) ? 1 : 0), 0);
    const shortness = avg > 0 ? Math.max(0, 1 - avg / 22) : 0;
    const tension = Math.min(1, (tensionHits / Math.max(6, pw.length / 12)) * 0.6 + shortness * 0.3 + Math.min(0.3, excl * 0.08));
    const pos = POSITIVE.reduce((n, w) => n + (pl.match(new RegExp(`\\b${w}\\w*`, "g"))?.length ?? 0), 0);
    const neg = NEGATIVE.reduce((n, w) => n + (pl.match(new RegExp(`\\b${w}\\w*`, "g"))?.length ?? 0), 0);
    const sentiment = pos + neg === 0 ? 0 : (pos - neg) / (pos + neg);
    return { index, words: pw.length, tension, sentiment, dialogue: dialogueShare(p), avgSentence: avg, preview: p.slice(0, 80) };
  });

  const lines = isVerse ? clean.split(/\n/).filter((l) => l.trim()) : [];
  const syllablesPerLine = lines.map((l) => words(l).reduce((n, w) => n + countSyllables(w), 0));
  const lineEndings = lines.map((l) => l.trim().split(/\s+/).pop() ?? "");

  return {
    words: wordCount,
    sentences: sentLens.length,
    paragraphs: paragraphs.length,
    readingMinutes: wordCount / 230,
    avgSentence,
    sentenceSpread: std(sentLens),
    longestSentence: Math.max(0, ...sentLens),
    flesch,
    grade,
    dialogueRatio: dialogueShare(clean),
    adverbRate: wordCount ? (adverbs / wordCount) * 100 : 0,
    passiveRate: sentLens.length ? (passive / sentLens.length) * 100 : 0,
    fillerRate: wordCount ? (filler / wordCount) * 100 : 0,
    vocabRichness,
    repeats,
    cliches,
    weakVerbs: weak,
    sensory,
    paragraphsPulse,
    syllablesPerLine,
    rhymeScheme: detectRhymeScheme(lines),
    lineEndings,
  };
}

/** Convert a Flesch reading ease score into a plain label. */
export function readabilityLabel(flesch: number): string {
  if (flesch >= 80) return "Very easy";
  if (flesch >= 65) return "Easy";
  if (flesch >= 50) return "Plain";
  if (flesch >= 35) return "Dense";
  return "Very dense";
}

export function htmlToText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }
  const el = document.createElement("div");
  el.innerHTML = html;
  const blocks = el.querySelectorAll("p, h1, h2, h3, li, blockquote, div");
  blocks.forEach((b) => b.appendChild(document.createTextNode("\n")));
  el.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  return (el.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
