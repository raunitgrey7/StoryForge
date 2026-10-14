import "server-only";

import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, RetryError, type LanguageModel } from "ai";

/**
 * Model pool with rotation and failover.
 *
 * Gemini: reads GOOGLE_API_KEY_1..9 and GOOGLE_GENERATIVE_AI_API_KEY. Free-tier
 * keys are rate limited per key, so the pool spreads load across all of them
 * and steps to the next key (and eventually a lighter model) when one is
 * exhausted or a model is overloaded.
 *
 * Explicit work: Gemini's own policy often declines graphic sexual content no
 * matter the safety settings. If OPENROUTER_API_KEY and STORYFORGE_EXPLICIT_MODEL
 * are set, requests for explicit-rated works go to that model first (OpenRouter
 * exposes many permissive models, several with free tiers), then fall back to
 * Gemini with safety filters off.
 */

/**
 * Prose ladder. On the free tier gemini-3.5-flash streams its first token
 * fast and then trickles for minutes; gemini-2.5-flash finishes a passage in
 * seconds with prose of the same quality, so it leads.
 */
const MODEL_LADDER = [
  process.env.STORYFORGE_MODEL ?? "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
];

/**
 * Explicit prose: gemini-2.5-flash finishes graphic scenes that 3.5-flash cuts
 * off mid-sentence, so it leads when the work is rated mature or explicit.
 */
const EXPLICIT_LADDER = [
  process.env.STORYFORGE_EXPLICIT_GEMINI ?? "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
];

/** Structured (JSON) tasks are slow on the big model in free tier; lead with the lite ones. */
const FAST_LADDER = [
  process.env.STORYFORGE_FAST_MODEL ?? "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
];

function readKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GOOGLE_API_KEY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  const single = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (single && single.trim()) keys.push(single.trim());
  return [...new Set(keys)];
}

function explicitProvider(): { model: LanguageModel; modelId: string; key: string } | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const modelId = process.env.STORYFORGE_EXPLICIT_MODEL?.trim();
  if (!key || !modelId) return null;
  const provider = createOpenAICompatible({
    name: "openrouter",
    apiKey: key,
    baseURL: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
    headers: { "HTTP-Referer": "https://storyforge.app", "X-Title": "StoryForge" },
  });
  return { model: provider(modelId), modelId: `openrouter/${modelId}`, key };
}

let cursor = Math.floor(Math.random() * 1000);
const cooldown = new Map<string, number>(); // key -> timestamp until which it is benched

export function hasKeys() {
  return readKeys().length > 0 || explicitProvider() !== null;
}

export function hasExplicitProvider() {
  return explicitProvider() !== null;
}

function nextKey(exclude: Set<string>): string | null {
  const keys = readKeys().filter((k) => !exclude.has(k));
  if (keys.length === 0) return null;
  const now = Date.now();
  const healthy = keys.filter((k) => (cooldown.get(k) ?? 0) < now);
  const pool = healthy.length ? healthy : keys;
  return pool[cursor++ % pool.length];
}

export interface Attempt {
  model: LanguageModel;
  modelId: string;
  key: string;
  /** Which provider family, so callers can pick provider options. */
  family: "google" | "openrouter";
}

/**
 * Yields (model, key) pairs to try in order. The caller runs its request
 * with each attempt until one succeeds. Rate-limit and overload errors
 * bench the key for a minute; after every key fails on a model we drop
 * down the ladder.
 */
export function* attempts(opts: { explicit?: boolean; fast?: boolean } = {}): Generator<Attempt> {
  if (opts.explicit) {
    const ex = explicitProvider();
    if (ex) yield { ...ex, family: "openrouter" };
  }
  const keys = readKeys();
  if (keys.length === 0) return;
  for (const modelId of opts.fast ? FAST_LADDER : opts.explicit ? EXPLICIT_LADDER : MODEL_LADDER) {
    const tried = new Set<string>();
    while (tried.size < keys.length) {
      const key = nextKey(tried);
      if (!key) break;
      tried.add(key);
      const google = createGoogle({ apiKey: key });
      yield { model: google(modelId), modelId, key, family: "google" };
    }
  }
}

export function benchKey(key: string, ms = 60_000) {
  cooldown.set(key, Date.now() + ms);
}

/** The SDK wraps provider errors in RetryError; look at the real one. */
function unwrap(err: unknown): unknown {
  return RetryError.isInstance(err) ? (err.lastError ?? err) : err;
}

export function isRetryable(raw: unknown): boolean {
  const err = unwrap(raw);
  if (APICallError.isInstance(err)) {
    const s = err.statusCode ?? 0;
    return s === 429 || s === 503 || s === 500 || s === 502 || s === 504 || s === 404 || err.isRetryable;
  }
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("overload") ||
    msg.includes("unavailable") ||
    msg.includes("fetch failed") ||
    msg.includes("no output") ||
    msg.includes("blocked") ||
    msg.includes("safety") ||
    msg.includes("prohibited")
  );
}

export function errorStatus(raw: unknown): number {
  const err = unwrap(raw);
  if (APICallError.isInstance(err) && err.statusCode) return err.statusCode;
  return 500;
}

/** Capacity problems (rate limit, overload) are per key; anything else is per model. */
export function isCapacityError(err: unknown): boolean {
  const s = errorStatus(err);
  if (s === 429 || s === 503 || s === 502 || s === 504) return true;
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return msg.includes("quota") || msg.includes("rate") || msg.includes("overload") || msg.includes("unavailable") || msg.includes("fetch failed");
}

export const MAX_ATTEMPTS = 8;
export const ATTEMPT_BUDGET_MS = 75_000;
/** After this many rate-limited keys on one model, step down the ladder instead of burning every key. */
export const KEYS_PER_MODEL = 2;

export function logAttempt(a: Attempt, raw: unknown) {
  const err = unwrap(raw);
  const msg = String((err as Error)?.message ?? err).replace(/\s+/g, " ").slice(0, 160);
  console.warn(`[storyforge] ${a.modelId} failed: ${msg}`);
}

/** Provider-specific options for a given attempt. Explicit work turns Gemini's filters off. */
export function providerOptions(a: Attempt, opts: { explicit: boolean; thinking: "minimal" | "low" }): { google: GoogleLanguageModelOptions } | undefined {
  if (a.family !== "google") return undefined;
  const threshold = opts.explicit ? "OFF" : "BLOCK_ONLY_HIGH";
  const google: GoogleLanguageModelOptions = {
    thinkingConfig: a.modelId.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: opts.thinking },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold },
    ],
  };
  return { google };
}

/**
 * Run `fn` against the attempt ladder until it succeeds.
 * Only the request setup is retried here; streaming errors after first
 * byte are surfaced to the client as a stream error.
 */
export async function withFailover<T>(fn: (a: Attempt) => Promise<T>, opts: { explicit?: boolean; fast?: boolean } = {}): Promise<T> {
  let lastErr: unknown = new Error("No AI key configured. Add GOOGLE_API_KEY_1 to .env.local.");
  const skipModels = new Set<string>();
  const capacityHits = new Map<string, number>();
  const started = Date.now();
  let tries = 0;
  for (const a of attempts(opts)) {
    if (skipModels.has(a.modelId)) continue;
    if (tries >= MAX_ATTEMPTS || Date.now() - started > ATTEMPT_BUDGET_MS) break;
    tries++;
    try {
      return await fn(a);
    } catch (err) {
      lastErr = err;
      logAttempt(a, err);
      if (!isRetryable(err)) throw err;
      if (isCapacityError(err)) {
        benchKey(a.key, errorStatus(err) === 429 ? 60_000 : 15_000);
        const n = (capacityHits.get(a.modelId) ?? 0) + 1;
        capacityHits.set(a.modelId, n);
        if (n >= KEYS_PER_MODEL) skipModels.add(a.modelId);
      } else skipModels.add(a.modelId); // the model itself declined; another key will not help
    }
  }
  throw lastErr;
}

/* Tiny in-memory rate limiter so a public deployment cannot be drained by one client. */
const buckets = new Map<string, { tokens: number; ts: number }>();
export function rateLimit(id: string, perMinute = 40): boolean {
  const now = Date.now();
  const b = buckets.get(id) ?? { tokens: perMinute, ts: now };
  const refill = ((now - b.ts) / 60_000) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.ts = now;
  if (b.tokens < 1) {
    buckets.set(id, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(id, b);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

export function clientId(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
