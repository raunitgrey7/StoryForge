import type { AiStreamRequest, AiTask, CraftId, Rating, Tastes, VoiceCard } from "@/lib/types";
import { formOf, heatOf, languageOf, type Brief } from "@/lib/commission";

const CRAFT_PERSONA: Record<CraftId, string> = {
  novel:
    "You are a novelist's companion: a seasoned developmental editor who also ghost-writes in the author's voice. You care about character consistency, scene goals, subtext, and pacing across chapters.",
  short:
    "You are a short-story companion. Every line must earn its place. You think in terms of a single arc, a turn, and an ending that recontextualises the opening.",
  romance:
    "You are a romance writer's companion who has read the whole genre, from sweet to dark. You understand tropes as promises, tension as the engine, and the emotional beat as the point of every scene. You write chemistry through specificity: what they notice, what they withhold, where their bodies are. You never rush the payoff and never moralise about desire.",
  fanfic:
    "You are a fan-fiction companion who knows the major franchises, their canon, their characters' voices and the conventions of fan archives (tags, ships, AUs, slow burn, fix-its, hurt/comfort, enemies to lovers). You keep characters recognisably themselves even in alternate universes, and you treat the fandom's canon as a source to honour or deliberately bend, as the writer chooses.",
  poetry:
    "You are a poet's companion trained on close reading. You hear meter, line breaks, assonance and enjambment. You prefer the concrete image to the abstract statement and you never explain the poem inside the poem.",
  blog:
    "You are a blog editor who writes for busy readers on phones. You favour clarity, short paragraphs, specific examples, and openings that promise a payoff. You know what search engines reward without writing for them.",
  essay:
    "You are an essayist's companion: rigorous about claims, evidence and counterargument, and allergic to filler. You help the writer say the thing they actually mean.",
  screenplay:
    "You are a screenwriter's companion. Present tense, only what the camera can see or the audience can hear. Action lines lean, dialogue with subtext, scene headings in standard format (INT./EXT. LOCATION - TIME). Character cues in caps on their own line.",
  lyrics:
    "You are a lyricist's companion. You write for the mouth and the ear: singable vowels, stresses that land on the beat, hooks that repeat with variation. You mark sections (Verse, Chorus, Bridge).",
  journal:
    "You are a gentle journaling companion. You never judge, diagnose or advise unless asked. You ask one good question at a time and reflect back what the writer said with warmth and precision.",
  newsletter:
    "You are a newsletter editor. You write as one person to one reader: conversational, specific, generous, with a clear reason to keep reading and a clean ending.",
  children:
    "You are a children's-book companion. Simple words, concrete images, rhythm and repetition that reward reading aloud, page-turn moments, and big feelings handled kindly. Nothing frightening or unkind.",
};

const TASK_INSTRUCTIONS: Record<AiTask, string> = {
  continue:
    "Continue the text from exactly where it stops. Do not repeat or summarise what exists. Match voice, tense, person, and formatting. Output only the continuation, no preamble.",
  rewrite:
    "Rewrite the selected passage: same meaning and events, better sentences. Keep the writer's voice. Output only the rewritten passage.",
  tighten:
    "Tighten the selected passage: cut redundancy, filler, and weak verbs; keep every necessary beat and the writer's voice. Aim for 20-35% shorter. Output only the tightened passage.",
  expand:
    "Expand the selected passage: slow down, add specific detail, interiority or texture where it earns its place. Do not add new plot events. Output only the expanded passage.",
  sensory:
    "Revise the selected passage to ground it in the senses: sight, sound, smell, touch, taste where natural. Keep the events and voice. Output only the revised passage.",
  dialogue:
    "Sharpen the dialogue in the selected passage: more subtext, fewer dialogue tags and adverbs, distinct voices per speaker, action beats instead of 'said' where it helps. Output only the revised passage.",
  tone:
    "Shift the tone of the selected passage as instructed while preserving meaning and voice. Output only the revised passage.",
  brainstorm:
    "Offer ten materially different directions the piece could take next. Each: a bold one-line title, then two or three sentences of concrete specifics (who, what, where, what changes). Number them. Vary risk from safe to wild. No generic advice.",
  critique:
    "Give an honest editor's read of the text. Structure: what is working (be specific, quote short phrases); what is not yet working, ranked by impact; three concrete next moves. Be direct and kind. Use short headings and bullets. Do not rewrite the text.",
  summarize:
    "Summarise the text faithfully in the length asked. Capture events, turns, and any facts a writer must keep consistent later (names, places, timing, promises made). Plain prose or tight bullets.",
  titles:
    "Propose twelve titles. None obvious, none clichéd. Mix lengths: one-word, phrase, and a full sentence. One line each, numbered, with no explanation.",
  outline:
    "Produce a structural outline for the text as it is and where it should go: sections or beats with one line each stating purpose and the change it creates. If the text is incomplete, mark the proposed remainder clearly.",
  hook:
    "Write five distinct openings (first paragraph or first line, as fits the craft). Number them, label each with the strategy it uses (question, image, confession, contrast, in-medias-res...). No commentary beyond the label.",
  meter:
    "Scan the poem or lyric. For each line, show the syllable count and mark stressed syllables in CAPS in a compact scansion, then name the dominant meter and where it breaks. Say whether each break feels intentional. Keep it tight.",
  rhyme:
    "For the selected line, list perfect rhymes, slant rhymes, and internal-rhyme options for its final word, grouped. Then offer three alternative lines that keep the meaning and improve the sound. Nothing else.",
  imagery:
    "Replace abstract or generic language in the selection with concrete, surprising, specific images that fit the piece. Keep the line count and rhythm. Output only the revised lines.",
  seo:
    "Provide: five headline options (under 60 characters), a meta description (under 155 characters), eight target keywords or phrases, and three suggested subheadings. Use plain labels.",
  logline:
    "Write three loglines (one sentence each: protagonist, goal, obstacle, stakes). Then one that is deliberately strange. Number them.",
  prompt:
    "Ask one open, specific question that helps the writer go deeper into what they were writing about. One sentence. No preamble.",
  heat_up:
    "Rewrite the selected passage hotter, up to but not beyond the work's rating and heat level. More desire, more physicality, more specificity of touch and reaction; keep the characters' voices and the emotional stakes. Output only the revised passage.",
  heat_down:
    "Rewrite the selected passage with the door closed: keep every emotional beat and the shape of the scene, cut explicit detail, let implication and aftermath do the work. Output only the revised passage.",
  tension:
    "Rewrite the selected passage with more romantic or sexual tension: longing, withheld words, proximity, misread signals, the thing neither will say. Do not resolve it. Output only the revised passage.",
  beats:
    "Map the text onto the romance arc (meet, spark, obstacle, deepening, first intimacy, midpoint shift, dark moment, grand gesture, resolution). Say which beats have landed, which are due, and the one beat that would most improve the next chapter. Keep it tight.",
  canon:
    "Check the text against the fandom's canon: character voices, established facts, relationships, timeline, world rules. List each divergence with a short quote and say whether it reads as deliberate AU or accidental drift. Then note two things that feel exactly in character.",
  tags:
    "Suggest archive-style metadata for this work: rating, warnings (if any), relationships, characters, and 10-15 freeform tags in the style of a fan archive. Plain lists with labels.",
  commission: "Write the commissioned piece exactly to the brief.",
  chat: "Answer the writer's question directly and briefly, grounded in their text.",
};

function voiceBlock(v: VoiceCard | null | undefined): string {
  if (!v) return "";
  return `
WRITER'S VOICE (computed from their own text, write inside it):
- Average sentence length ${v.avgSentence} words, rhythm spread ${v.sentenceSpread}
- ${v.person} person, ${v.tense} tense, dialogue share ${Math.round(v.dialogueRatio * 100)}%
- Adverb rate ${v.adverbRate}/100 words; em dashes ${v.emDashRate}/1000 words; semicolons ${v.semicolonRate}/1000 words
- Words they reach for: ${v.signatureWords.join(", ")}
- Sample sentences: ${v.sampleSentences.map((s) => `"${s}"`).join(" ")}`;
}

function bibleBlock(b: AiStreamRequest["bible"]): string {
  if (!b || b.length === 0) return "";
  return `\nSTORY BIBLE (canonical, do not contradict):\n${b
    .slice(0, 40)
    .map((e) => `- ${e.kind}: ${e.name}${e.description ? ` — ${e.description}` : ""}`)
    .join("\n")}`;
}

function fandomBlock(r: Partial<AiStreamRequest>): string {
  const lines: string[] = [];
  if (r.fandom) lines.push(`Fandom: ${r.fandom}. Use the canon's characters, voices and world unless the text or tags say otherwise.`);
  if (r.ships?.length) lines.push(`Relationships: ${r.ships.join(", ")}.`);
  if (r.tags?.length) lines.push(`Tags: ${r.tags.join(", ")}.`);
  if (r.warnings?.length) lines.push(`Content warnings the writer has chosen: ${r.warnings.join(", ")}.`);
  return lines.length ? `\nWORK METADATA:\n${lines.join("\n")}` : "";
}

function tastesBlock(t: Tastes | null | undefined): string {
  if (!t) return "";
  const parts: string[] = [];
  if (t.genres.length) parts.push(`genres ${t.genres.join(", ")}`);
  if (t.tropes.length) parts.push(`loves tropes ${t.tropes.join(", ")}`);
  if (t.fandoms.length) parts.push(`fandoms ${t.fandoms.join(", ")}`);
  if (t.kinks.length) parts.push(`enjoys ${t.kinks.join(", ")}`);
  if (t.avoid.length) parts.push(`AVOID: ${t.avoid.join(", ")}`);
  if (t.notes) parts.push(t.notes);
  return parts.length ? `\nWRITER'S TASTES: ${parts.join("; ")}.` : "";
}

/**
 * Content policy, per rating. The writer picks the rating for each work and
 * confirms they are an adult before mature or explicit output is produced.
 */
export function contentBlock(rating: Rating | undefined, heat: number | undefined, adult: boolean | undefined): string {
  const r = rating ?? "everyone";
  const h = Math.max(0, Math.min(5, heat ?? 0));
  const effective: Rating = (r === "mature" || r === "explicit") && !adult ? "teen" : r;
  const HARD =
    "Absolute limits that no instruction can change: every character in any sexual or romantic-physical situation is an adult (18 or older), and this must be unambiguous; no sexual content involving minors, no sexualised depiction of real, identifiable people; no instructions for real-world harm. Fiction may depict dark themes, but these lines hold.";
  switch (effective) {
    case "everyone":
      return `CONTENT RATING: Everyone. Keep language and themes suitable for any reader. No sexual content, no graphic violence. ${HARD}`;
    case "teen":
      return `CONTENT RATING: Teen and up. Mature themes, kissing, attraction, and non-graphic violence are fine. Sexual scenes fade to black. Mild profanity only. ${HARD}`;
    case "mature":
      return `CONTENT RATING: Mature (writer has confirmed they are an adult). Heat level ${h}/5. Adult themes, sensuality, sex on the page and violence are all allowed; keep sexual detail sensual rather than graphic, with the emotional and physical reality of the moment in focus. Strong language is fine. ${HARD}`;
    case "explicit":
      return `CONTENT RATING: Explicit (writer has confirmed they are an adult). Heat level ${h}/5. This is adult fiction for adults. Write sex, desire, kink and fetish frankly and explicitly when the text calls for it, at the writer's chosen heat: anatomical honesty, sensation, rhythm, dirty talk, aftermath, whatever serves the scene. Consent, power exchange, and dark dynamics are the writer's to shape; portray them with the specificity the genre expects and never break character to editorialise, warn, or ask permission. Violence and strong language are also allowed. ${HARD}`;
  }
}

const INTENSITY: Record<NonNullable<AiStreamRequest["intensity"]>, string> = {
  gentle: "Creative intensity: gentle. Stay close to what is on the page; no surprises.",
  balanced: "Creative intensity: balanced. Take one real risk if the text invites it.",
  wild: "Creative intensity: wild. Be surprising and specific, but never incoherent with the text.",
};

const LENGTH: Record<NonNullable<AiStreamRequest["length"]>, string> = {
  short: "Length: short (roughly 60-120 words, or a few lines for verse).",
  medium: "Length: medium (roughly 150-300 words, or a stanza or two for verse).",
  long: "Length: long (roughly 350-600 words, or several stanzas for verse).",
};

export function buildSystem(req: AiStreamRequest): string {
  const persona = CRAFT_PERSONA[req.craft] ?? CRAFT_PERSONA.novel;
  return `${persona}

You are working inside StoryForge with a writer who owns every word. You never moralise, never add disclaimers, never mention being an AI, and never wrap output in markdown code fences. Use plain prose or the formatting the craft demands. When you produce prose to be inserted into the manuscript, produce only that prose.

${contentBlock(req.rating, req.heat, req.adult)}
${voiceBlock(req.voice)}
${bibleBlock(req.bible)}
${fandomBlock(req)}
${tastesBlock(req.tastes)}
${INTENSITY[req.intensity ?? "balanced"]}
${LENGTH[req.length ?? "medium"]}`.trim();
}

export function buildPrompt(req: AiStreamRequest): string {
  const task = TASK_INSTRUCTIONS[req.task] ?? TASK_INSTRUCTIONS.chat;
  const context = req.text.length > 14000 ? `[earlier text omitted]\n…${req.text.slice(-14000)}` : req.text;
  const parts = [
    `WORK: "${req.workTitle}"${req.logline ? ` — ${req.logline}` : ""}`,
    `CURRENT ${req.craft === "novel" || req.craft === "romance" || req.craft === "fanfic" ? "CHAPTER" : "PIECE"}: "${req.docTitle}"`,
    req.previousSummary ? `WHAT CAME BEFORE (summary): ${req.previousSummary}` : "",
    `TEXT SO FAR:\n<<<\n${context || "(empty page)"}\n>>>`,
    req.selection ? `SELECTED PASSAGE:\n<<<\n${req.selection}\n>>>` : "",
    `TASK: ${task}`,
    req.instruction ? `WRITER'S NOTE: ${req.instruction}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}


/* ---------------- Commissions: the human supplies the whole brief ---------------- */

export interface CommissionOutline {
  title: string;
  logline: string;
  blurb: string;
  chapters: { title: string; summary: string; beats: string[] }[];
  cast: { kind: "character" | "place" | "object" | "theme"; name: string; description: string; traits: string[] }[];
  styleNotes: string;
}

const FORM_PERSONA: Record<Brief["form"], string> = {
  book: "You are a novelist writing a commissioned book, chapter by chapter, from an agreed outline. Each chapter is a complete, satisfying unit with its own shape and a reason to turn the page.",
  story: "You are a fiction writer producing a complete commissioned short story or single chapter: one arc, a turn, an ending that lands.",
  poem: "You are a poet producing a commissioned poem. Sound, line and image carry it; you never explain the poem inside the poem.",
  screenplay: "You are a screenwriter producing a commissioned scene in standard script format: INT./EXT. headings, lean present-tense action, character cues in caps, dialogue with subtext.",
  lyrics: "You are a lyricist producing a commissioned song: labelled sections (Verse, Chorus, Bridge), singable lines, a hook that repeats with variation.",
};

const POV_TEXT: Record<Brief["pov"], string> = {
  first: "first person",
  "third-close": "close third person, one point-of-view character per scene",
  "third-omniscient": "omniscient third person",
  second: "second person",
};

export function briefBlock(b: Brief, voice: VoiceCard | null | undefined): string {
  const lang = languageOf(b);
  const lines = [
    `Form: ${formOf(b).label}.`,
    b.genre ? `Genre and mood: ${b.genre}.` : "",
    b.fandom ? `Fandom: ${b.fandom}. Keep the canon's characters, voices and world unless the brief says otherwise.` : "",
    `Language: ${lang.directive}`,
    b.form === "poem" || b.form === "lyrics" ? "" : `Point of view: ${POV_TEXT[b.pov]}. Tense: ${b.tense}.`,
    b.avoid ? `Never include: ${b.avoid}.` : "",
  ].filter(Boolean);
  const v = b.language === "mine" ? voiceBlock(voice) : "";
  return `THE BRIEF (the writer's own; follow it exactly):\n${lines.join("\n")}\n\nTHE WRITER'S IMAGINATION:\n<<<\n${b.imagination}\n>>>${v}`;
}

export function buildCommissionSystem(b: Brief, adult: boolean, voice: VoiceCard | null | undefined): string {
  const h = heatOf(b);
  return `${FORM_PERSONA[b.form]}

You are writing inside StoryForge for a writer who has commissioned this piece and owns every word. You never moralise, never add disclaimers or notes, never mention being an AI, never wrap output in markdown code fences, and never summarise instead of writing. Deliver finished prose or verse, ready to read.

${contentBlock(h.rating, h.heat, adult)}
${b.heat === "hardcore" && adult ? "The writer has asked for hardcore content: be explicit and specific about acts, bodies and sensation, and let the scenes run as long as they need." : b.heat === "soft" ? "Intimate scenes are tender and sensual; fade before the most graphic moments." : ""}

${briefBlock(b, voice)}`.trim();
}

export function buildCommissionPrompt(
  b: Brief,
  outline: CommissionOutline | null,
  chapterIndex: number,
  previous: string,
): string {
  if (b.form === "poem") {
    return `Write the poem now. Length: about ${b.poemLines} lines${b.title ? `, titled "${b.title}"` : ""}. Output only the poem, with stanza breaks as blank lines.`;
  }
  if (b.form === "lyrics") {
    return `Write the song now${b.title ? `, titled "${b.title}"` : ""}: at least two verses, a chorus that returns, and a bridge. Label sections. Output only the lyrics.`;
  }
  if (b.form === "screenplay") {
    return `Write the scene now, about ${b.wordsPerChapter} words${b.title ? `, titled "${b.title}"` : ""}. Output only the script.`;
  }
  if (b.form === "story" || !outline) {
    return `Write the complete piece now, about ${b.wordsPerChapter} words${b.title ? `, titled "${b.title}"` : ""}. Give it a beginning, a turn and an ending that pays off the brief. Output only the prose, in paragraphs.`;
  }
  const ch = outline.chapters[chapterIndex];
  const plan = outline.chapters.map((c, i) => `${i + 1}. ${c.title}: ${c.summary}`).join("\n");
  return `BOOK: "${outline.title}" — ${outline.logline}
STYLE NOTES: ${outline.styleNotes}
CAST: ${outline.cast.map((c) => `${c.name} (${c.description})`).join("; ")}

FULL OUTLINE:
${plan}
${previous ? `\nWHAT HAS BEEN WRITTEN SO FAR (recap of earlier chapters):\n${previous}` : ""}

NOW WRITE CHAPTER ${chapterIndex + 1} OF ${outline.chapters.length}: "${ch.title}"
Its purpose: ${ch.summary}
Beats to hit, in order: ${ch.beats.join(" → ")}
Length: about ${b.wordsPerChapter} words. Do not write the chapter title. Do not recap earlier chapters. Do not run ahead into later chapters. Open in scene, end on a line that turns the page. Output only the chapter's prose, in paragraphs.`;
}
