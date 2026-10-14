import { generateText, Output } from "ai";
import { z } from "zod";
import { briefBlock, buildCommissionSystem, contentBlock } from "@/lib/ai/prompts";
import { heatOf, type Brief } from "@/lib/commission";
import { clientId, errorStatus, hasKeys, providerOptions, rateLimit, withFailover } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Structured companion tasks. Each returns validated JSON the UI can act on.
 * The Muse tasks generate recommendations from the writer's tastes and library.
 */

const Tastes = z.object({
  genres: z.array(z.string()).max(30),
  tropes: z.array(z.string()).max(40),
  fandoms: z.array(z.string()).max(30),
  kinks: z.array(z.string()).max(40),
  avoid: z.array(z.string()).max(40),
  heat: z.number().min(0).max(5),
  notes: z.string().max(1000),
});

const Base = z.object({
  task: z.enum(["entities", "forks", "continuity", "compass", "seed", "muse_character", "muse_plot", "muse_story", "muse_chapter", "muse_book", "commission_outline", "illustration_brief"]),
  craft: z.string(),
  workTitle: z.string().max(300),
  logline: z.string().max(1000).optional(),
  text: z.string().max(60_000),
  bible: z.array(z.object({ kind: z.string(), name: z.string(), description: z.string(), traits: z.array(z.string()).optional() })).max(120).optional(),
  instruction: z.string().max(2000).optional(),
  rating: z.enum(["everyone", "teen", "mature", "explicit"]).optional(),
  heat: z.number().min(0).max(5).optional(),
  adult: z.boolean().optional(),
  fandom: z.string().max(200).optional(),
  ships: z.array(z.string().max(120)).max(20).optional(),
  tags: z.array(z.string().max(80)).max(40).optional(),
  tastes: Tastes.optional().nullable(),
  /** Titles and loglines of the writer's other works, so the Muse can avoid repeating them. */
  library: z.array(z.object({ title: z.string().max(200), craft: z.string(), logline: z.string().max(400) })).max(60).optional(),
  brief: z
    .object({
      form: z.enum(["book", "story", "poem", "screenplay", "lyrics"]),
      genre: z.string().max(200),
      fandom: z.string().max(200).optional(),
      heat: z.enum(["none", "soft", "medium", "hardcore"]),
      language: z.enum(["modern", "classic", "lyrical", "plain", "noir", "mine"]),
      pov: z.enum(["first", "third-close", "third-omniscient", "second"]),
      tense: z.enum(["past", "present"]),
      chapters: z.number().min(1).max(30),
      wordsPerChapter: z.number().min(200).max(4000),
      poemLines: z.number().min(4).max(200),
      title: z.string().max(200).optional(),
      imagination: z.string().max(12_000),
      avoid: z.string().max(1000).optional(),
    })
    .optional(),
  voice: z.any().optional().nullable(),
});
type B = z.infer<typeof Base>;

const EntitySchema = z.object({
  entities: z.array(
    z.object({
      kind: z.enum(["character", "place", "object", "theme", "fact"]),
      name: z.string(),
      aliases: z.array(z.string()),
      description: z.string(),
      traits: z.array(z.string()),
    }),
  ),
});

const ForkSchema = z.object({
  forks: z.array(
    z.object({
      label: z.string(),
      kind: z.enum(["twist", "escalation", "emotional", "genre_shift", "quiet", "structural"]),
      premise: z.string(),
      firstLines: z.string(),
      cost: z.string(),
      reward: z.string(),
    }),
  ),
});

const ContinuitySchema = z.object({
  score: z.number(),
  issues: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high"]),
      about: z.string(),
      quote: z.string(),
      conflict: z.string(),
      fix: z.string(),
    }),
  ),
  praise: z.array(z.string()),
});

const CompassSchema = z.object({
  whereWeAre: z.string(),
  promises: z.array(z.string()),
  nextBeat: z.string(),
  danger: z.string(),
  questionForWriter: z.string(),
});

const Cast = z.array(z.object({ kind: z.enum(["character", "place", "object", "theme"]), name: z.string(), description: z.string(), traits: z.array(z.string()) }));

const SeedSchema = z.object({
  title: z.string(),
  logline: z.string(),
  units: z.array(z.object({ title: z.string(), goal: z.string(), opening: z.string() })),
  cast: Cast,
});

const MuseCharacterSchema = z.object({
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      hook: z.string(),
      description: z.string(),
      wants: z.string(),
      wound: z.string(),
      voice: z.string(),
      traits: z.array(z.string()),
    }),
  ),
});

const MusePlotSchema = z.object({
  plots: z.array(z.object({ title: z.string(), premise: z.string(), turns: z.array(z.string()), ending: z.string(), tropes: z.array(z.string()) })),
});

const MuseStorySchema = z.object({
  stories: z.array(z.object({ title: z.string(), craft: z.string(), logline: z.string(), blurb: z.string(), why: z.string(), tags: z.array(z.string()), heat: z.number() })),
});

const MuseChapterSchema = z.object({
  chapters: z.array(z.object({ title: z.string(), goal: z.string(), beats: z.array(z.string()), opening: z.string(), closing: z.string() })),
});

const IllustrationBriefSchema = z.object({
  scene: z.string(),
  characters: z.string(),
  setting: z.string(),
  mood: z.string(),
  palette: z.string(),
});

const CommissionOutlineSchema = z.object({
  title: z.string(),
  logline: z.string(),
  blurb: z.string(),
  chapters: z.array(z.object({ title: z.string(), summary: z.string(), beats: z.array(z.string()) })),
  cast: Cast,
  styleNotes: z.string(),
});

const MuseBookSchema = z.object({
  title: z.string(),
  logline: z.string(),
  blurb: z.string(),
  tags: z.array(z.string()),
  chapters: z.array(z.object({ title: z.string(), goal: z.string(), summary: z.string(), opening: z.string() })),
  cast: Cast,
});

function tastes(b: B): string {
  const t = b.tastes;
  if (!t) return "";
  const parts: string[] = [];
  if (t.genres.length) parts.push(`genres: ${t.genres.join(", ")}`);
  if (t.tropes.length) parts.push(`favourite tropes: ${t.tropes.join(", ")}`);
  if (t.fandoms.length) parts.push(`fandoms: ${t.fandoms.join(", ")}`);
  if (t.kinks.length) parts.push(`enjoys: ${t.kinks.join(", ")}`);
  if (t.avoid.length) parts.push(`must avoid: ${t.avoid.join(", ")}`);
  parts.push(`preferred heat ${t.heat}/5`);
  if (t.notes) parts.push(`notes: ${t.notes}`);
  return `\nWRITER'S TASTES: ${parts.join("; ")}.`;
}

function library(b: B): string {
  if (!b.library?.length) return "";
  return `\nTHEIR LIBRARY (do not repeat these, but learn from what they like):\n${b.library.map((w) => `- ${w.title} (${w.craft})${w.logline ? `: ${w.logline}` : ""}`).join("\n")}`;
}

function bible(b: B): string {
  return b.bible?.length ? `\n\nSTORY BIBLE:\n${b.bible.map((e) => `- ${e.kind}: ${e.name} — ${e.description}${e.traits?.length ? ` [${e.traits.join(", ")}]` : ""}`).join("\n")}` : "";
}

function meta(b: B): string {
  const l: string[] = [];
  if (b.fandom) l.push(`Fandom: ${b.fandom}`);
  if (b.ships?.length) l.push(`Ships: ${b.ships.join(", ")}`);
  if (b.tags?.length) l.push(`Tags: ${b.tags.join(", ")}`);
  return l.length ? `\n${l.join(". ")}.` : "";
}

const PROMPTS: Record<B["task"], (b: B) => string> = {
  entities: (b) =>
    `Extract the story bible from this ${b.craft} text. Include characters (with role and visible traits), places, significant objects, recurring themes, and hard facts a writer must keep consistent (ages, dates, distances, rules of the world). Merge duplicates and aliases. Descriptions must be text-grounded and under 30 words. Skip anything trivial.${b.bible?.length ? `\n\nKNOWN ENTITIES (update or extend, do not duplicate):\n${b.bible.map((e) => `- ${e.kind}: ${e.name} — ${e.description}`).join("\n")}` : ""}\n\nTEXT:\n<<<\n${b.text}\n>>>`,
  forks: (b) =>
    `You are a possibility engine for a ${b.craft} titled "${b.workTitle}"${b.logline ? ` (${b.logline})` : ""}.${meta(b)} Propose six materially different branches for what happens next. Each needs: a 2-4 word label; a kind; a concrete premise (who does what, where, what changes) in 2-3 sentences; the first 2-4 sentences of that branch written in the text's voice; what the branch costs the story; what it rewards. Use the story bible names when present. Range from quiet to wild.${b.instruction ? `\nWriter's steer: ${b.instruction}` : ""}${bible(b)}\n\nTEXT SO FAR (ending is where branches begin):\n<<<\n${b.text.slice(-12000)}\n>>>`,
  continuity: (b) =>
    `Check this text for continuity against the story bible and against itself. Look for contradictions in names, appearance, relationships, timeline, geography, objects that appear or vanish, tense or point-of-view slips, and facts stated then broken. Quote the exact phrase for each issue. Score 0-100 for consistency. Also note two or three things handled well.${meta(b)}\n\nSTORY BIBLE:\n${(b.bible ?? []).map((e) => `- ${e.kind}: ${e.name} — ${e.description}${e.traits?.length ? ` [${e.traits.join(", ")}]` : ""}`).join("\n") || "(none yet)"}\n\nTEXT:\n<<<\n${b.text}\n>>>`,
  compass: (b) =>
    `Read this ${b.craft} in progress and orient the writer. whereWeAre: one paragraph on the current state of the piece (tension, open questions, tone). promises: the promises the text has made to the reader that must be paid off. nextBeat: the single most useful next beat, concrete. danger: the biggest risk if the piece continues as it is. questionForWriter: one sharp question only the writer can answer.${meta(b)}${bible(b)}\n\nTEXT:\n<<<\n${b.text.slice(-16000)}\n>>>`,
  seed: (b) =>
    `A writer wants to start a new ${b.craft}. Their idea: "${b.instruction ?? b.text}".${meta(b)}${tastes(b)} Propose a working title, a one-sentence logline, 4-6 units (chapters, poems, posts, scenes, as fits the craft) each with a title, a one-line goal, and a two-sentence opening written in a fitting voice, plus a cast of 4-6 bible entries (characters, places, objects, themes) with short descriptions and 2-4 traits each.`,
  muse_character: (b) =>
    `Recommend four characters this writer would love to write${b.workTitle ? ` for their ${b.craft} "${b.workTitle}"${b.logline ? ` (${b.logline})` : ""}` : ""}. Each: name, role in a story, a one-line hook, a vivid description, what they want, the wound under it, how they talk (voice), and 3-5 traits. Make them specific and unlike each other.${meta(b)}${tastes(b)}${library(b)}${bible(b)}${b.instruction ? `\nWriter's steer: ${b.instruction}` : ""}${b.text ? `\n\nCURRENT TEXT (for context):\n<<<\n${b.text.slice(-6000)}\n>>>` : ""}`,
  muse_plot: (b) =>
    `Recommend four plots${b.workTitle ? ` for the ${b.craft} "${b.workTitle}"${b.logline ? ` (${b.logline})` : ""}` : " this writer would love"}. Each: a title, a two-sentence premise, four to six turns (concrete events that change the situation), an ending, and the tropes it plays. Vary scale and tone.${meta(b)}${tastes(b)}${library(b)}${bible(b)}${b.instruction ? `\nWriter's steer: ${b.instruction}` : ""}${b.text ? `\n\nCURRENT TEXT (for context):\n<<<\n${b.text.slice(-6000)}\n>>>` : ""}`,
  muse_story: (b) =>
    `Recommend five story ideas this writer should write next, based on their tastes and library. Each: title, the craft it suits (novel, short, romance, fanfic, poetry, screenplay...), a logline, a back-cover blurb of 40-60 words, one sentence on why it fits this writer, 5-8 archive-style tags, and a heat level 0-5. Include one that stretches them. Be concise.${tastes(b)}${library(b)}${b.instruction ? `\nWriter's steer: ${b.instruction}` : ""}`,
  muse_chapter: (b) =>
    `Recommend three possible next chapters for the ${b.craft} "${b.workTitle}"${b.logline ? ` (${b.logline})` : ""}. Each: a title, a goal, 4-7 beats, a strong opening paragraph in the text's voice, and a closing line that turns the page. Ground them in what has happened.${meta(b)}${tastes(b)}${bible(b)}${b.instruction ? `\nWriter's steer: ${b.instruction}` : ""}\n\nTEXT SO FAR:\n<<<\n${b.text.slice(-14000)}\n>>>`,
  illustration_brief: (b) =>
    `Choose the single most visual and most charged moment in this chapter for a full-page book illustration, and describe it for an illustrator who has not read the text. scene: one vivid sentence of what is happening (bodies, gesture, the distance between people, what hands, mouths and eyes are doing). characters: how the people look as original designs, ages as the work states them, build, hair, expression, the state of their clothing. setting: the place, light and time. mood: the emotional temperature. palette: three or four colours. ${b.rating === "explicit" || b.rating === "mature" ? "This is an adult work between adults: pick the most intimate, charged moment and describe it at an editorial, sensual level (skin, sheer fabric and lingerie implied, bare shoulders, backs and legs, bodies close in low light, faces flushed), without describing exposed nipples or genitals or a sex act." : "Keep it suitable for the work's rating."}${b.instruction ? `

WORK CONTEXT: ${b.instruction}` : ""}${meta(b)}

CHAPTER:
<<<
${b.text.slice(0, 14000)}
>>>`,
  commission_outline: (b) => {
    const br = b.brief as Brief;
    return `Plan the commissioned book before it is written. Return: a title${br.title ? ` (the writer suggested "${br.title}"; use it unless it is clearly worse)` : ""}, a one-sentence logline, a back-cover blurb of 80-120 words, exactly ${br.chapters} chapters each with a title, a two-sentence summary of what happens and changes, and 4-7 concrete beats; a cast of 5-10 bible entries (characters, places, objects, themes) with descriptions and traits; and styleNotes: a paragraph telling the chapter-writer how the prose should sound, drawn from the brief's language choice. The whole arc must pay off the writer's imagination: every character, event and ending they asked for appears. ${br.heat !== "none" ? `Intimate scenes are part of the plan; place them where they carry the most weight, at the ${br.heat} level.` : ""}\n\n${briefBlock(br, b.voice ?? null)}`;
  },
  muse_book: (b) =>
    `Design a whole book this writer would love to write${b.instruction ? `, from this idea: "${b.instruction}"` : ", from their tastes"}. Return: title, logline, a back-cover blurb (80-120 words), 8-12 archive-style tags, 10-12 chapters each with a title, a goal, a one-sentence summary, and a two-sentence opening in a fitting voice, and a cast of 6-8 bible entries (characters, places, objects, themes) with descriptions and traits. The craft is ${b.craft}.${meta(b)}${tastes(b)}${library(b)}`,
};

export async function POST(req: Request) {
  if (!hasKeys()) return Response.json({ error: "No AI key configured. Add GOOGLE_API_KEY_1 to .env.local." }, { status: 503 });
  if (!rateLimit(clientId(req), 30)) return Response.json({ error: "Too many requests. Give it a minute." }, { status: 429 });

  let body: B;
  try {
    body = Base.parse(await req.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const prompt = PROMPTS[body.task](body);
  const creative = body.task === "forks" || body.task === "seed" || body.task.startsWith("muse_");
  const rating = body.task === "commission_outline" && body.brief ? heatOf(body.brief as Brief).rating : body.rating;
  const explicit = Boolean(body.adult && (rating === "explicit" || rating === "mature"));
  const system =
    body.task === "commission_outline" && body.brief
      ? `${buildCommissionSystem(body.brief as Brief, Boolean(body.adult), body.voice ?? null)}\n\nYou answer only with the requested JSON.`
      : `You are StoryForge's structured companion. You answer only with the requested JSON, text-grounded, specific, no filler. You never moralise.\n\n${contentBlock(body.rating, body.heat, body.adult)}`;

  const run = <T,>(schema: z.ZodType<T>) =>
    withFailover(
      async (a) => {
        const { output } = await generateText({
          model: a.model,
          system,
          prompt,
          temperature: creative ? 0.95 : 0.3,
          maxRetries: 0,
          maxOutputTokens: body.task === "muse_book" || body.task === "commission_outline" ? 8000 : 3000,
          output: Output.object({ schema }),
          abortSignal: req.signal,
          timeout: { totalMs: body.task === "muse_book" || body.task === "commission_outline" ? 90_000 : 45_000 },
          providerOptions: providerOptions(a, { explicit, thinking: "minimal" }),
        });
        return output;
      },
      { explicit, fast: true },
    );

  try {
    let data: unknown;
    switch (body.task) {
      case "entities": data = await run(EntitySchema); break;
      case "forks": data = await run(ForkSchema); break;
      case "continuity": data = await run(ContinuitySchema); break;
      case "compass": data = await run(CompassSchema); break;
      case "seed": data = await run(SeedSchema); break;
      case "muse_character": data = await run(MuseCharacterSchema); break;
      case "muse_plot": data = await run(MusePlotSchema); break;
      case "muse_story": data = await run(MuseStorySchema); break;
      case "muse_chapter": data = await run(MuseChapterSchema); break;
      case "muse_book": data = await run(MuseBookSchema); break;
      case "commission_outline": data = await run(CommissionOutlineSchema); break;
      case "illustration_brief": data = await run(IllustrationBriefSchema); break;
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const status = errorStatus(err);
    const raw = String((err as Error)?.message ?? "The companion is unavailable right now.");
    return Response.json(
      { error: (status === 429 || /quota|rate/i.test(raw) ? "Every key is rate-limited right now. Free-tier quotas refill within a minute; try again shortly." : raw).slice(0, 400) },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
