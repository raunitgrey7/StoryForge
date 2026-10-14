"use client";

import { db, uid } from "./db";
import type { Doc, Entity, EntityKind } from "./types";

/** Count mentions of every entity across a work's docs and store the links. */
export async function relinkEntities(workId: string): Promise<Entity[]> {
  const [entities, docs] = await Promise.all([
    db.entities.where("workId").equals(workId).toArray(),
    db.docs.where("workId").equals(workId).toArray(),
  ]);
  const updated: Entity[] = [];
  for (const e of entities) {
    const names = [e.name, ...e.aliases].filter((n) => n && n.length > 1);
    const patterns = names.map((n) => new RegExp(`\\b${escapeRe(n)}\\b`, "gi"));
    let mentions = 0;
    const docIds: string[] = [];
    for (const d of docs) {
      let hits = 0;
      for (const p of patterns) hits += d.text.match(p)?.length ?? 0;
      if (hits > 0) docIds.push(d.id);
      mentions += hits;
    }
    if (mentions !== e.mentions || docIds.join() !== e.docIds.join()) {
      const next = { ...e, mentions, docIds, updatedAt: Date.now() };
      await db.entities.put(next);
      updated.push(next);
    } else updated.push(e);
  }
  return updated;
}

export async function upsertEntities(
  workId: string,
  incoming: { kind: EntityKind; name: string; aliases?: string[]; description?: string; traits?: string[] }[],
) {
  const existing = await db.entities.where("workId").equals(workId).toArray();
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
  const now = Date.now();
  let added = 0;
  let merged = 0;
  for (const inc of incoming) {
    const key = inc.name.trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key) ?? existing.find((e) => e.aliases.some((a) => a.toLowerCase() === key));
    if (prev) {
      const aliases = [...new Set([...prev.aliases, ...(inc.aliases ?? [])].filter((a) => a.toLowerCase() !== prev.name.toLowerCase()))];
      const traits = [...new Set([...prev.traits, ...(inc.traits ?? [])])].slice(0, 12);
      await db.entities.update(prev.id, {
        aliases,
        traits,
        description: prev.description || inc.description || "",
        updatedAt: now,
      });
      merged++;
    } else {
      const e: Entity = {
        id: uid("e"),
        workId,
        kind: inc.kind,
        name: inc.name.trim(),
        aliases: (inc.aliases ?? []).filter((a) => a.toLowerCase() !== key),
        description: inc.description ?? "",
        traits: (inc.traits ?? []).slice(0, 12),
        docIds: [],
        mentions: 0,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.entities.add(e);
      byName.set(key, e);
      added++;
    }
  }
  await relinkEntities(workId);
  return { added, merged };
}

export function entitiesInDoc(entities: Entity[], doc: Doc | undefined): Entity[] {
  if (!doc) return [];
  return entities.filter((e) => e.docIds.includes(doc.id));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const KIND_META: Record<EntityKind, { label: string; hue: number; plural: string }> = {
  character: { label: "Character", plural: "Characters", hue: 42 },
  place: { label: "Place", plural: "Places", hue: 170 },
  object: { label: "Object", plural: "Objects", hue: 280 },
  theme: { label: "Theme", plural: "Themes", hue: 330 },
  fact: { label: "Fact", plural: "Facts", hue: 210 },
};
