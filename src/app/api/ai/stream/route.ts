import { streamText } from "ai";
import { z } from "zod";
import { buildCommissionPrompt, buildCommissionSystem, buildPrompt, buildSystem, type CommissionOutline } from "@/lib/ai/prompts";
import { heatOf, type Brief } from "@/lib/commission";
import { ATTEMPT_BUDGET_MS, KEYS_PER_MODEL, MAX_ATTEMPTS, attempts, benchKey, clientId, errorStatus, hasKeys, isCapacityError, isRetryable, logAttempt, providerOptions, rateLimit } from "@/lib/ai/provider";
import type { AiStreamRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const Tastes = z.object({
  genres: z.array(z.string()).max(30),
  tropes: z.array(z.string()).max(40),
  fandoms: z.array(z.string()).max(30),
  kinks: z.array(z.string()).max(40),
  avoid: z.array(z.string()).max(40),
  heat: z.number().min(0).max(5),
  notes: z.string().max(1000),
});

const Body = z.object({
  task: z.string(),
  craft: z.string(),
  workTitle: z.string().max(300),
  logline: z.string().max(1000).optional(),
  docTitle: z.string().max(300),
  text: z.string().max(60_000),
  selection: z.string().max(12_000).optional(),
  instruction: z.string().max(2000).optional(),
  voice: z.any().optional().nullable(),
  bible: z.array(z.object({ kind: z.string(), name: z.string(), description: z.string() })).max(80).optional(),
  previousSummary: z.string().max(4000).optional(),
  intensity: z.enum(["gentle", "balanced", "wild"]).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  rating: z.enum(["everyone", "teen", "mature", "explicit"]).optional(),
  heat: z.number().min(0).max(5).optional(),
  adult: z.boolean().optional(),
  fandom: z.string().max(200).optional(),
  ships: z.array(z.string().max(120)).max(20).optional(),
  tags: z.array(z.string().max(80)).max(40).optional(),
  warnings: z.array(z.string().max(80)).max(20).optional(),
  tastes: Tastes.optional().nullable(),
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
  outline: z.any().optional().nullable(),
  chapterIndex: z.number().min(0).max(40).optional(),
});

const TEMPERATURE: Record<string, number> = {
  brainstorm: 1.0,
  titles: 1.0,
  hook: 0.95,
  continue: 0.85,
  expand: 0.8,
  imagery: 0.9,
  heat_up: 0.9,
  tension: 0.85,
  critique: 0.5,
  canon: 0.3,
  beats: 0.4,
  tags: 0.5,
  meter: 0.2,
  summarize: 0.3,
  seo: 0.5,
  rhyme: 0.7,
};

export async function POST(req: Request) {
  if (!hasKeys()) {
    return new Response("No AI key configured. Add GOOGLE_API_KEY_1 to .env.local and restart.", { status: 503 });
  }
  if (!rateLimit(clientId(req), 60)) {
    return new Response("Too many requests. Give it a minute.", { status: 429 });
  }

  let body: AiStreamRequest & { brief?: Brief; outline?: CommissionOutline | null; chapterIndex?: number };
  try {
    body = Body.parse(await req.json()) as typeof body;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const commission = body.task === "commission" && body.brief ? body.brief : null;
  const rating = commission ? heatOf(commission).rating : body.rating;
  const explicit = Boolean(body.adult && (rating === "explicit" || rating === "mature"));
  const system = commission ? buildCommissionSystem(commission, Boolean(body.adult), body.voice) : buildSystem(body);
  const prompt = commission ? buildCommissionPrompt(commission, body.outline ?? null, body.chapterIndex ?? 0, body.previousSummary ?? "") : buildPrompt(body);
  const temperature = commission ? 0.9 : (TEMPERATURE[body.task] ?? 0.7);
  const maxTokens = commission ? Math.min(8000, Math.round(((commission.form === "book" || commission.form === "story" || commission.form === "screenplay" ? commission.wordsPerChapter : 600) * 1.9) + 400)) : body.length === "long" ? 2200 : 1400;

  // Try each provider/key/model until the first token arrives, then stream the rest.
  let lastErr: unknown = null;
  const skipModels = new Set<string>();
  const capacityHits = new Map<string, number>();
  const started = Date.now();
  let tries = 0;
  for (const attempt of attempts({ explicit })) {
    if (skipModels.has(attempt.modelId)) continue;
    if (tries >= MAX_ATTEMPTS || Date.now() - started > ATTEMPT_BUDGET_MS) break;
    tries++;
    try {
      const result = streamText({
        model: attempt.model,
        system,
        prompt,
        temperature,
        maxRetries: 0, // rotation across keys and models is handled here, instantly
        maxOutputTokens: maxTokens,
        abortSignal: req.signal,
        timeout: { firstChunkMs: 40_000, totalMs: commission ? 240_000 : 120_000 },
        providerOptions: providerOptions(attempt, { explicit, thinking: "minimal" }),
      });

      const reader = result.stream.getReader();
      const encoder = new TextEncoder();

      // Wait for the first text delta (or an error) before committing to this attempt.
      let firstText = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === "error") throw value.error;
        if (value.type === "text-delta") {
          firstText = value.text;
          break;
        }
      }
      if (!firstText) throw new Error("no output from the model");

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(firstText));
          (async () => {
            try {
              for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value.type === "text-delta") controller.enqueue(encoder.encode(value.text));
                else if (value.type === "finish") {
                  const reason = value.finishReason;
                  if (reason === "content-filter" || reason === "other") {
                    console.warn(`[storyforge] ${attempt.modelId} stopped early: ${reason}`);
                    controller.enqueue(
                      encoder.encode(
                        `\n\n[${attempt.modelId} stopped here: the provider's content policy cut the passage off. ${explicit ? "This is Gemini's own limit on graphic sex, not the app's. Route explicit work to an OpenRouter model (OPENROUTER_API_KEY + STORYFORGE_EXPLICIT_MODEL), or lower the heat for this pass." : "Try rephrasing or lowering the intensity."}]`,
                      ),
                    );
                  } else if (reason === "length") {
                    controller.enqueue(encoder.encode("\n\n[Stopped at the length limit. Press Again to keep going.]"));
                  }
                } else if (value.type === "error") {
                  controller.enqueue(encoder.encode(`\n\n[The companion lost the thread: ${String((value.error as Error)?.message ?? value.error)}]`));
                  break;
                }
              }
              controller.close();
            } catch (err) {
              try {
                controller.error(err);
              } catch {}
            }
          })();
        },
        cancel() {
          reader.cancel().catch(() => {});
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-StoryForge-Model": attempt.modelId,
        },
      });
    } catch (err) {
      lastErr = err;
      if (req.signal.aborted) return new Response(null, { status: 499 });
      logAttempt(attempt, err);
      if (!isRetryable(err)) break;
      if (isCapacityError(err)) {
        benchKey(attempt.key, errorStatus(err) === 429 ? 60_000 : 15_000);
        const n = (capacityHits.get(attempt.modelId) ?? 0) + 1;
        capacityHits.set(attempt.modelId, n);
        if (n >= KEYS_PER_MODEL) skipModels.add(attempt.modelId);
      } else skipModels.add(attempt.modelId);
    }
  }

  const raw = String((lastErr as Error)?.message ?? lastErr ?? "The companion is unavailable right now.");
  const message =
    explicit && /no output|blocked|safety|prohibited/i.test(raw)
      ? "The model declined this passage at the current rating. Gemini's free tier often refuses graphic content; set OPENROUTER_API_KEY and STORYFORGE_EXPLICIT_MODEL to route explicit work to a model that allows it, or lower the heat for this pass."
      : raw;
  const status = errorStatus(lastErr);
  const friendly =
    status === 429 || /quota|rate/i.test(raw)
      ? "Every key is rate-limited right now. Free-tier quotas refill within a minute; try again shortly."
      : message;
  return new Response(friendly.slice(0, 600), { status: status >= 400 && status < 600 ? status : 502 });
}
