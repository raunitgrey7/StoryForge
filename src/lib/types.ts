export type CraftId =
  | "novel"
  | "short"
  | "romance"
  | "fanfic"
  | "poetry"
  | "blog"
  | "essay"
  | "screenplay"
  | "lyrics"
  | "journal"
  | "newsletter"
  | "children";

export type EntityKind = "character" | "place" | "object" | "theme" | "fact";

/** Content rating, in the spirit of fan-archive ratings. */
export type Rating = "everyone" | "teen" | "mature" | "explicit";

export interface Work {
  id: string;
  title: string;
  craft: CraftId;
  logline: string;
  hue: number; // 0-360, used for the Atlas star colour and rail accents
  createdAt: number;
  updatedAt: number;
  wordGoal?: number;
  rating: Rating;
  /** Fan-fiction metadata. Fandom is free text; ships as "A/B" or "A & B". */
  fandom?: string;
  ships: string[];
  tags: string[];
  warnings: string[];
  /** Heat level 0 (closed door) to 5 (fully explicit). Applies at mature/explicit ratings. */
  heat: number;
}

export interface Doc {
  id: string;
  workId: string;
  title: string;
  order: number;
  html: string;
  text: string;
  wordCount: number;
  /** Fork lineage: a doc forked from another keeps the parent id and a label. */
  parentId?: string;
  forkLabel?: string;
  status: "draft" | "revising" | "done";
  goal?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Entity {
  id: string;
  workId: string;
  kind: EntityKind;
  name: string;
  aliases: string[];
  description: string;
  traits: string[];
  /** doc ids in which the entity appears, computed locally */
  docIds: string[];
  mentions: number;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Snapshot {
  id: string;
  docId: string;
  html: string;
  wordCount: number;
  reason: string;
  createdAt: number;
}

export interface Sprint {
  id: string;
  workId: string;
  docId: string;
  startedAt: number;
  endedAt?: number;
  minutes: number;
  wordsStart: number;
  wordsEnd?: number;
  goalWords: number;
}

/** An illustration for a piece, stored as a data URL. */
export interface Illustration {
  id: string;
  workId: string;
  docId: string;
  dataUrl: string; // image/jpeg or image/png
  prompt: string;
  caption: string;
  provider: string;
  createdAt: number;
  updatedAt: number;
}

/** Records a deletion so cloud sync can propagate it. */
export interface Tombstone {
  id: string; // id of the deleted row
  table: "works" | "docs" | "entities" | "snapshots" | "sprints" | "illustrations";
  deletedAt: number;
}

/** Reading position, per work. */
export interface Progress {
  workId: string;
  docId: string;
  scroll: number; // 0..1
  updatedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** What the writer likes. Drives the Muse and colours every companion suggestion. */
export interface Tastes {
  genres: string[];
  tropes: string[];
  fandoms: string[];
  kinks: string[];
  avoid: string[];
  heat: number; // preferred heat 0..5
  notes: string;
}

export interface Profile {
  displayName: string;
  adultVerified: boolean;
  adultVerifiedAt?: number;
  tastes: Tastes;
  updatedAt: number;
}

export const EMPTY_TASTES: Tastes = { genres: [], tropes: [], fandoms: [], kinks: [], avoid: [], heat: 2, notes: "" };

export interface VoiceCard {
  avgSentence: number;
  sentenceSpread: number;
  vocabRichness: number;
  dialogueRatio: number;
  adverbRate: number;
  emDashRate: number;
  semicolonRate: number;
  person: "first" | "second" | "third" | "mixed";
  tense: "past" | "present" | "mixed";
  signatureWords: string[];
  sampleSentences: string[];
  words: number;
}

export type AiTask =
  | "continue"
  | "rewrite"
  | "tighten"
  | "expand"
  | "sensory"
  | "dialogue"
  | "tone"
  | "brainstorm"
  | "critique"
  | "summarize"
  | "titles"
  | "outline"
  | "hook"
  | "meter"
  | "rhyme"
  | "imagery"
  | "seo"
  | "logline"
  | "prompt"
  | "heat_up"
  | "heat_down"
  | "tension"
  | "beats"
  | "canon"
  | "tags"
  | "commission"
  | "chat";

export interface WorkContext {
  rating: Rating;
  heat: number;
  fandom?: string;
  ships?: string[];
  tags?: string[];
  warnings?: string[];
  /** The writer has confirmed they are an adult. Required for mature/explicit output. */
  adult: boolean;
}

export interface AiStreamRequest extends Partial<WorkContext> {
  task: AiTask;
  craft: CraftId;
  workTitle: string;
  logline?: string;
  docTitle: string;
  text: string;
  selection?: string;
  instruction?: string;
  voice?: VoiceCard | null;
  bible?: { kind: EntityKind; name: string; description: string }[];
  previousSummary?: string;
  intensity?: "gentle" | "balanced" | "wild";
  length?: "short" | "medium" | "long";
  tastes?: Tastes | null;
}

export const RATING_META: Record<Rating, { label: string; short: string; blurb: string }> = {
  everyone: { label: "Everyone", short: "E", blurb: "Suitable for any reader." },
  teen: { label: "Teen and up", short: "T", blurb: "Some mature themes, nothing graphic." },
  mature: { label: "Mature", short: "M", blurb: "Adult themes, sensuality, violence. Sex may happen on the page without graphic detail." },
  explicit: { label: "Explicit", short: "X", blurb: "Graphic sex, kink and violence between adult characters, written frankly." },
};
