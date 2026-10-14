"use client";

import { db, uid } from "./db";
import { craftOf } from "./crafts";
import type { Doc, Illustration, Work } from "./types";

/**
 * One illustration per piece, drawn from the piece itself. The prompt asks
 * for a book illustration in a style suited to the craft; for mature and
 * explicit work it asks for sensual, not graphic, imagery.
 */

const STYLE: Partial<Record<Work["craft"], string>> = {
  novel: "painterly literary book illustration, ink wash and muted colour",
  short: "painterly literary book illustration, ink wash and muted colour",
  romance: "romantic painterly illustration, warm light, soft focus, cinematic",
  fanfic: "dramatic illustrated cover art, painterly, cinematic light",
  poetry: "delicate lyrical illustration, watercolour and ink, lots of white space",
  lyrics: "album-art style illustration, bold and atmospheric",
  screenplay: "cinematic storyboard frame, dramatic composition",
  children: "warm children's picture-book illustration, gouache, friendly shapes",
  journal: "quiet sketchbook illustration, pencil and wash",
  blog: "clean editorial illustration, flat colour, modern",
  essay: "clean editorial illustration, flat colour, modern",
  newsletter: "clean editorial illustration, flat colour, modern",
};

interface Brief {
  scene: string;
  characters: string;
  setting: string;
  mood: string;
  palette: string;
}

/** Ask the companion to pick the chapter's most charged visual moment, knowing the whole work. */
async function briefFor(work: Work, doc: Doc): Promise<Brief | null> {
  try {
    const earlier = (await db.docs.where("workId").equals(work.id).sortBy("order")).filter((d) => !d.parentId && d.order < doc.order);
    const context = [work.logline, ...earlier.map((d) => `${d.title}: ${d.text.slice(0, 500).replace(/\s+/g, " ")}`)].filter(Boolean).join(" | ").slice(0, 2000);
    const res = await fetch("/api/ai/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "illustration_brief", craft: work.craft, workTitle: work.title, logline: work.logline, text: doc.text, instruction: context, rating: work.rating, heat: work.heat, adult: true, fandom: work.fandom, ships: work.ships, tags: work.tags }),
    });
    if (!res.ok) return null;
    return (await res.json()) as Brief;
  } catch {
    return null;
  }
}

export function illustrationPrompt(work: Work, doc: Doc, brief?: Brief | null): string {
  const adultWork = work.rating === "explicit" || work.rating === "mature";
  if (brief?.scene) {
    return `${STYLE[work.craft] ?? STYLE.novel}. Exactly these people, with these looks, every one of them in the frame together as adults: ${brief.characters}. ${brief.scene} Setting: ${brief.setting}. Mood: ${brief.mood}. Palette: ${brief.palette}.${work.fandom ? ` In the world of ${work.fandom}; original character designs, not real actors.` : ""}${adultWork ? " Adult, editorial and sensual: charged poses, skin, sheer fabric and lingerie implied, bare shoulders, backs and legs, low light on bodies close together, flushed faces. No exposed nipples or genitals, no sexual acts shown." : ""} Highly detailed, dramatic composition, no text, no letters, no watermark, no borders.`;
  }
  const excerpt = doc.text.replace(/\s+/g, " ").slice(0, 700);
  const heat =
    work.rating === "explicit" || work.rating === "mature"
      ? " Adult, editorial and sensual, like a fashion-magazine intimacy shoot: charged poses, skin, sheer fabric and lingerie implied, bare shoulders and backs, low light on bodies close together. No exposed nipples or genitals, no sexual acts shown. All adults."
      : "";
  const fandom = work.fandom ? ` Setting and mood of ${work.fandom}; original character designs, not real actors.` : "";
  return `${STYLE[work.craft] ?? STYLE.novel}. A single illustration for the chapter "${doc.title}" of "${work.title}"${work.logline ? ` (${work.logline})` : ""}. Scene: ${excerpt}${fandom}${heat} No text, no letters, no watermark, no borders.`;
}

export async function illustrate(work: Work, doc: Doc, aspect: "landscape" | "portrait" | "square" = "landscape"): Promise<Illustration> {
  const brief = await briefFor(work, doc);
  const prompt = illustrationPrompt(work, doc, brief);
  const res = await fetch("/api/ai/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspect }) });
  const data = (await res.json().catch(() => ({}))) as { dataUrl?: string; provider?: string; error?: string };
  if (!res.ok || !data.dataUrl) throw new Error(data.error ?? `The illustrator answered with ${res.status}.`);
  const existing = await db.illustrations.where("docId").equals(doc.id).first();
  const now = Date.now();
  const ill: Illustration = {
    id: existing?.id ?? uid("i"),
    workId: work.id,
    docId: doc.id,
    dataUrl: data.dataUrl,
    prompt,
    caption: doc.title,
    provider: data.provider ?? "unknown",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.illustrations.put(ill);
  return ill;
}

export async function illustrationsFor(workId: string): Promise<Map<string, Illustration>> {
  const rows = await db.illustrations.where("workId").equals(workId).toArray();
  return new Map(rows.map((r) => [r.docId, r]));
}

export function craftLabel(work: Work) {
  return craftOf(work.craft).unitLabel.toLowerCase();
}
