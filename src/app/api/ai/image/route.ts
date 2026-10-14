import { generateText } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { z } from "zod";
import { clientId, rateLimit } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Illustrations. Three providers, tried in order:
 *  1. An OpenAI-compatible images endpoint you configure (STORYFORGE_IMAGE_BASE_URL,
 *     STORYFORGE_IMAGE_API_KEY, STORYFORGE_IMAGE_MODEL).
 *  2. Gemini's image model on your keys (needs billing enabled on the key; the
 *     free tier has no image quota).
 *  3. Pollinations, a keyless public service, best effort.
 * Every provider gets the same prompt, which never asks for graphic sexual content.
 */

const Body = z.object({
  prompt: z.string().min(10).max(2000),
  aspect: z.enum(["landscape", "portrait", "square"]).default("landscape"),
});

function readKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GOOGLE_API_KEY_${i}`];
    if (k?.trim()) keys.push(k.trim());
  }
  return keys;
}

async function viaOpenAiCompatible(prompt: string, aspect: string): Promise<{ dataUrl: string; provider: string } | null> {
  const base = process.env.STORYFORGE_IMAGE_BASE_URL?.trim();
  const key = process.env.STORYFORGE_IMAGE_API_KEY?.trim();
  const model = process.env.STORYFORGE_IMAGE_MODEL?.trim();
  if (!base || !key || !model) return null;
  const size = aspect === "portrait" ? "768x1024" : aspect === "square" ? "1024x1024" : "1024x768";
  const res = await fetch(`${base.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, size, response_format: "b64_json" }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image endpoint answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const first = data.data?.[0];
  if (first?.b64_json) return { dataUrl: `data:image/png;base64,${first.b64_json}`, provider: `custom/${model}` };
  if (first?.url) {
    const img = await fetch(first.url);
    const buf = Buffer.from(await img.arrayBuffer());
    return { dataUrl: `data:${img.headers.get("content-type") || "image/png"};base64,${buf.toString("base64")}`, provider: `custom/${model}` };
  }
  throw new Error("Image endpoint returned no image");
}

async function viaGemini(prompt: string, aspect: string): Promise<{ dataUrl: string; provider: string } | null> {
  const keys = readKeys();
  if (!keys.length) return null;
  const modelId = process.env.STORYFORGE_IMAGE_GEMINI?.trim() || "gemini-2.5-flash-image";
  let lastErr: unknown = null;
  for (const key of keys.slice(0, 3)) {
    try {
      const google = createGoogle({ apiKey: key });
      const result = await generateText({
        model: google(modelId),
        prompt,
        maxRetries: 0,
        providerOptions: {
          google: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { aspectRatio: aspect === "portrait" ? "3:4" : aspect === "square" ? "1:1" : "16:9" },
          },
        },
      });
      const file = result.files.find((f) => f.mediaType.startsWith("image/"));
      if (file) return { dataUrl: `data:${file.mediaType};base64,${file.base64}`, provider: modelId };
      lastErr = new Error("Gemini returned no image");
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error).message ?? err);
      if (!/quota|429|rate|overload|503/i.test(msg)) break;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

async function viaPollinations(prompt: string, aspect: string): Promise<{ dataUrl: string; provider: string }> {
  const [w, h] = aspect === "portrait" ? [768, 1024] : aspect === "square" ? [896, 896] : [1024, 640];
  const seed = Math.floor(Math.random() * 1e6);
  let lastStatus = 0;
  for (const model of ["flux", ""]) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&enhance=true&seed=${seed}${model ? `&model=${model}` : ""}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(100_000), headers: { Accept: "image/*" } });
      const type = res.headers.get("content-type") || "";
      lastStatus = res.status;
      if (!res.ok || !type.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      return { dataUrl: `data:${type};base64,${buf.toString("base64")}`, provider: `pollinations/${model || "default"}` };
    } catch {
      continue;
    }
  }
  throw new Error(`Pollinations answered ${lastStatus || "nothing"}`);
}

export async function POST(req: Request) {
  if (!rateLimit(`img:${clientId(req)}`, 12)) return Response.json({ error: "Too many images requested. Give it a minute." }, { status: 429 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const errors: string[] = [];
  for (const attempt of [viaOpenAiCompatible, viaGemini, viaPollinations]) {
    try {
      const out = await attempt(body.prompt, body.aspect);
      if (out) return Response.json(out, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      errors.push(`${attempt.name}: ${String((err as Error).message ?? err).slice(0, 160)}`);
      console.warn(`[storyforge] image ${errors[errors.length - 1]}`);
    }
  }
  return Response.json(
    {
      error:
        "No image provider could draw this right now. Gemini's free tier has no image quota (enable billing on one key, or set STORYFORGE_IMAGE_BASE_URL / STORYFORGE_IMAGE_API_KEY / STORYFORGE_IMAGE_MODEL for another provider). The free fallback was unavailable.",
      details: errors,
    },
    { status: 503 },
  );
}
