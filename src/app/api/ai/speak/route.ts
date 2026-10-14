import { z } from "zod";
import { benchKey, clientId, rateLimit } from "@/lib/ai/provider";
import { VOICE_IDS, VOICES, type VoiceId } from "@/lib/voices";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Neural read-aloud through Gemini's speech models. One paragraph per call;
 * the client prefetches the next while the current one plays. Output is a
 * WAV so the browser can play it without any decoding library.
 */



const Body = z.object({
  text: z.string().min(1).max(1800),
  voice: z.enum(VOICE_IDS as [VoiceId, ...VoiceId[]]).default("soft-british"),
});

const MODELS = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];

function readKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GOOGLE_API_KEY_${i}`];
    if (k?.trim()) keys.push(k.trim());
  }
  return keys;
}

/** Wrap raw 16-bit mono PCM in a WAV header. */
function wav(pcm: Buffer, rate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

let cursor = 0;

export async function POST(req: Request) {
  if (!rateLimit(`tts:${clientId(req)}`, 90)) return new Response("Too many requests. Give it a minute.", { status: 429 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const keys = readKeys();
  if (!keys.length) return new Response("No Gemini key configured.", { status: 503 });
  const v = VOICES[body.voice];
  let lastErr = "";

  for (const model of MODELS) {
    for (let k = 0; k < Math.min(3, keys.length); k++) {
      const key = keys[(cursor++) % keys.length];
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${v.style}\n\n${body.text}` }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.voice } } } },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (res.status === 429 || res.status >= 500) {
          benchKey(key, res.status === 429 ? 60_000 : 15_000);
          lastErr = `${model}: ${res.status}`;
          continue;
        }
        if (!res.ok) {
          lastErr = `${model}: ${res.status} ${(await res.text()).slice(0, 120)}`;
          break; // this model rejected the request; try the next model
        }
        const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
        const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType.startsWith("audio/"));
        if (!part?.inlineData) {
          lastErr = `${model}: no audio`;
          break;
        }
        const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
        const pcm = Buffer.from(part.inlineData.data, "base64");
        return new Response(new Uint8Array(wav(pcm, rate)), {
          headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400", "X-StoryForge-Voice": `${model}/${v.voice}` },
        });
      } catch (err) {
        lastErr = `${model}: ${String((err as Error).message ?? err).slice(0, 100)}`;
      }
    }
  }
  console.warn(`[storyforge] speak failed: ${lastErr}`);
  return new Response(`The voice is unavailable right now (${lastErr}).`, { status: 503 });
}
