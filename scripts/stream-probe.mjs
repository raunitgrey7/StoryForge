// Probe: does the SDK stream close after the model finishes? Run with:
//   node --env-file=.env.local scripts/stream-probe.mjs
import { createGoogle } from "@ai-sdk/google";
import { streamText } from "ai";

const key = process.env.GOOGLE_API_KEY_1;
const google = createGoogle({ apiKey: key });
const t0 = Date.now();
const result = streamText({
  model: google(process.argv[2] ?? "gemini-2.5-flash"),
  prompt: "Write two short sentences about a fox who is afraid of the dark.",
  maxOutputTokens: 200,
  providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
});
for await (const part of result.stream) {
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  if (part.type === "text-delta") process.stdout.write(`[${t}s delta ${part.text.length}] `);
  else console.log(`\n[${t}s ${part.type}]`, part.type === "finish" ? part.finishReason : "");
}
console.log(`\nstream closed at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
