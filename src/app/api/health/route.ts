import { hasKeys } from "@/lib/ai/provider";

export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ok: true,
    app: "storyforge",
    companion: hasKeys() ? "ready" : "no-keys",
    time: new Date().toISOString(),
  });
}
