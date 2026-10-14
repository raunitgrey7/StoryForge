import type { CraftId, Rating } from "./types";

/**
 * A commission is the human's complete brief. The writer chooses every
 * option and supplies the whole imagination; the companion writes to it.
 * Shared by the wizard (client) and the prompt builders (server).
 */

export type CommissionForm = "book" | "story" | "poem" | "screenplay" | "lyrics";
export type HeatChoice = "none" | "soft" | "medium" | "hardcore";
export type LanguageStyle = "modern" | "classic" | "lyrical" | "plain" | "noir" | "mine";
export type Pov = "first" | "third-close" | "third-omniscient" | "second";
export type Tense = "past" | "present";

export interface Brief {
  form: CommissionForm;
  genre: string; // free text, e.g. "dark fantasy romance"
  fandom?: string;
  heat: HeatChoice;
  language: LanguageStyle;
  pov: Pov;
  tense: Tense;
  chapters: number; // for book
  wordsPerChapter: number; // for book and story
  poemLines: number; // for poem
  title?: string;
  imagination: string; // the whole idea: characters, world, plot, ending, must-haves
  avoid?: string;
}

export const FORMS: { id: CommissionForm; label: string; blurb: string; craft: CraftId }[] = [
  { id: "book", label: "A book", blurb: "Several chapters, written one after another from an outline.", craft: "novel" },
  { id: "story", label: "One chapter or short story", blurb: "A single complete piece, as long as you like.", craft: "short" },
  { id: "poem", label: "A poem", blurb: "Any length, any form. Say the form in your brief if you want one.", craft: "poetry" },
  { id: "screenplay", label: "A screenplay scene", blurb: "Standard script format: headings, action, dialogue.", craft: "screenplay" },
  { id: "lyrics", label: "A song", blurb: "Verses, chorus, bridge. Made for the mouth.", craft: "lyrics" },
];

export const HEAT: { id: HeatChoice; label: string; blurb: string; rating: Rating; heat: number }[] = [
  { id: "none", label: "No sexual content", blurb: "Romance is fine; the door stays closed.", rating: "teen", heat: 0 },
  { id: "soft", label: "Soft", blurb: "Sensual, suggestive, tender. Sex happens but the camera looks away at the peak.", rating: "mature", heat: 2 },
  { id: "medium", label: "Medium", blurb: "On the page and honest about bodies, without clinical detail.", rating: "mature", heat: 3 },
  { id: "hardcore", label: "Hardcore", blurb: "Fully explicit, kink and fetish as you describe them, nothing softened.", rating: "explicit", heat: 5 },
];

export const LANGUAGE: { id: LanguageStyle; label: string; blurb: string; directive: string }[] = [
  { id: "modern", label: "Modern English", blurb: "Clean, contemporary prose. Contractions, natural dialogue.", directive: "Contemporary English: clean sentences, contractions, natural dialogue, no archaisms." },
  { id: "classic", label: "Classic English", blurb: "The cadence of Austen, the Brontës, Dickens. Formal address, longer periods.", directive: "Classic literary English in the manner of the nineteenth-century novel: measured, periodic sentences; formal address (Mr, Miss, sir); a rich but precise vocabulary; wit in the narration; no modern slang or anachronism." },
  { id: "lyrical", label: "Lyrical", blurb: "Image-rich, musical, close to poetry.", directive: "Lyrical prose: strong images, rhythm in the sentences, sensory precision; never purple, every metaphor earned." },
  { id: "plain", label: "Plain and spare", blurb: "Short sentences. Hemingway, Carver. Nothing wasted.", directive: "Plain, spare prose: short declarative sentences, concrete nouns, few adjectives, subtext carrying the weight." },
  { id: "noir", label: "Noir", blurb: "Hard-boiled, wry, shadowed.", directive: "Noir voice: wry, hard-boiled first-hand observation, sharp similes, moral shadow, dialogue that bites." },
  { id: "mine", label: "My own voice", blurb: "Match how I already write, from my library.", directive: "Write inside the writer's own voice card exactly." },
];

export const POV: { id: Pov; label: string }[] = [
  { id: "third-close", label: "Third person, close" },
  { id: "first", label: "First person" },
  { id: "third-omniscient", label: "Third person, omniscient" },
  { id: "second", label: "Second person" },
];

export function heatOf(brief: Brief) {
  return HEAT.find((h) => h.id === brief.heat) ?? HEAT[0];
}

export function formOf(brief: Brief) {
  return FORMS.find((f) => f.id === brief.form) ?? FORMS[1];
}

export function languageOf(brief: Brief) {
  return LANGUAGE.find((l) => l.id === brief.language) ?? LANGUAGE[0];
}

export const DEFAULT_BRIEF: Brief = {
  form: "story",
  genre: "",
  heat: "none",
  language: "modern",
  pov: "third-close",
  tense: "past",
  chapters: 8,
  wordsPerChapter: 1500,
  poemLines: 24,
  imagination: "",
};
