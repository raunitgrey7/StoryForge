"use client";

import Dexie, { type EntityTable } from "dexie";
import {
  EMPTY_TASTES,
  type Doc,
  type Entity,
  type Illustration,
  type Profile,
  type Progress,
  type Setting,
  type Snapshot,
  type Sprint,
  type Tombstone,
  type Work,
} from "./types";

/**
 * StoryForge is local-first. Everything you write lives in your browser's
 * IndexedDB. With an account, the same rows sync to the cloud so you can pick
 * up on another device; without one, nothing leaves the device unless you
 * export it or ask the companion for help with a specific passage.
 */
class StoryForgeDB extends Dexie {
  works!: EntityTable<Work, "id">;
  docs!: EntityTable<Doc, "id">;
  entities!: EntityTable<Entity, "id">;
  snapshots!: EntityTable<Snapshot, "id">;
  sprints!: EntityTable<Sprint, "id">;
  tombstones!: EntityTable<Tombstone, "id">;
  illustrations!: EntityTable<Illustration, "id">;
  progress!: EntityTable<Progress, "workId">;
  settings!: EntityTable<Setting, "key">;

  constructor() {
    super("storyforge");
    this.version(1).stores({
      works: "id, updatedAt, craft",
      docs: "id, workId, order, updatedAt, parentId",
      entities: "id, workId, kind, name",
      snapshots: "id, docId, createdAt",
      sprints: "id, workId, docId, startedAt",
      settings: "key",
    });
    this.version(2)
      .stores({
        works: "id, updatedAt, craft, rating",
        docs: "id, workId, order, updatedAt, parentId",
        entities: "id, workId, kind, name, updatedAt",
        snapshots: "id, docId, createdAt",
        sprints: "id, workId, docId, startedAt",
        tombstones: "id, table, deletedAt",
        progress: "workId, updatedAt",
        settings: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table("works")
          .toCollection()
          .modify((w: Partial<Work>) => {
            w.rating ??= "everyone";
            w.ships ??= [];
            w.tags ??= [];
            w.warnings ??= [];
            w.heat ??= 0;
          });
      });
    this.version(3).stores({
      works: "id, updatedAt, craft, rating",
      docs: "id, workId, order, updatedAt, parentId",
      entities: "id, workId, kind, name, updatedAt",
      snapshots: "id, docId, createdAt",
      sprints: "id, workId, docId, startedAt",
      tombstones: "id, table, deletedAt",
      progress: "workId, updatedAt",
      illustrations: "id, workId, docId, updatedAt",
      settings: "key",
    });
  }
}

export const db = new StoryForgeDB();

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${rand}` : rand;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

/* ---------- Profile (who is writing, what they like) ---------- */

export const PROFILE_KEY = "sf:profile";

export async function getProfile(): Promise<Profile> {
  const p = await getSetting<Partial<Profile> | null>(PROFILE_KEY, null);
  return {
    displayName: p?.displayName ?? "",
    adultVerified: p?.adultVerified ?? false,
    adultVerifiedAt: p?.adultVerifiedAt,
    tastes: { ...EMPTY_TASTES, ...(p?.tastes ?? {}) },
    updatedAt: p?.updatedAt ?? 0,
  };
}

export async function saveProfile(patch: Partial<Profile>) {
  const cur = await getProfile();
  const next: Profile = { ...cur, ...patch, tastes: { ...cur.tastes, ...(patch.tastes ?? {}) }, updatedAt: Date.now() };
  await setSetting(PROFILE_KEY, next);
  return next;
}

/* ---------- Works and docs ---------- */

export async function createWork(input: Partial<Work> & Pick<Work, "title" | "craft">): Promise<Work> {
  const now = Date.now();
  const work: Work = {
    id: uid("w"),
    title: input.title,
    craft: input.craft,
    logline: input.logline ?? "",
    hue: input.hue ?? Math.floor(Math.random() * 360),
    createdAt: now,
    updatedAt: now,
    wordGoal: input.wordGoal,
    rating: input.rating ?? "everyone",
    fandom: input.fandom,
    ships: input.ships ?? [],
    tags: input.tags ?? [],
    warnings: input.warnings ?? [],
    heat: input.heat ?? 0,
  };
  await db.works.add(work);
  return work;
}

export async function updateWork(id: string, patch: Partial<Work>) {
  await db.works.update(id, { ...patch, updatedAt: Date.now() });
}

export async function createDoc(workId: string, title: string, extra: Partial<Doc> = {}): Promise<Doc> {
  const count = await db.docs.where("workId").equals(workId).count();
  const now = Date.now();
  const doc: Doc = {
    id: uid("d"),
    workId,
    title,
    order: extra.order ?? count,
    html: extra.html ?? "",
    text: extra.text ?? "",
    wordCount: extra.wordCount ?? 0,
    status: extra.status ?? "draft",
    parentId: extra.parentId,
    forkLabel: extra.forkLabel,
    goal: extra.goal,
    createdAt: now,
    updatedAt: now,
  };
  await db.docs.add(doc);
  await db.works.update(workId, { updatedAt: now });
  return doc;
}

export async function saveDocContent(docId: string, html: string, text: string) {
  const wordCount = countWords(text);
  const now = Date.now();
  await db.docs.update(docId, { html, text, wordCount, updatedAt: now });
  const doc = await db.docs.get(docId);
  if (doc) await db.works.update(doc.workId, { updatedAt: now });
  return wordCount;
}

export async function snapshotDoc(docId: string, reason: string) {
  const doc = await db.docs.get(docId);
  if (!doc) return;
  const last = await db.snapshots.where("docId").equals(docId).reverse().sortBy("createdAt");
  if (last[0] && last[0].html === doc.html) return; // nothing changed
  await db.snapshots.add({
    id: uid("s"),
    docId,
    html: doc.html,
    wordCount: doc.wordCount,
    reason,
    createdAt: Date.now(),
  });
  // keep the newest 60 snapshots per doc
  const all = await db.snapshots.where("docId").equals(docId).sortBy("createdAt");
  if (all.length > 60) {
    const old = all.slice(0, all.length - 60);
    await db.snapshots.bulkDelete(old.map((s) => s.id));
    await addTombstones("snapshots", old.map((s) => s.id));
  }
}

async function addTombstones(table: Tombstone["table"], ids: string[]) {
  const now = Date.now();
  await db.tombstones.bulkPut(ids.map((id) => ({ id, table, deletedAt: now })));
}

export async function deleteWork(workId: string) {
  const docs = await db.docs.where("workId").equals(workId).toArray();
  const entities = await db.entities.where("workId").equals(workId).toArray();
  const sprints = await db.sprints.where("workId").equals(workId).toArray();
  await db.transaction("rw", [db.works, db.docs, db.entities, db.snapshots, db.sprints, db.tombstones, db.progress, db.illustrations], async () => {
    for (const d of docs) {
      const snaps = await db.snapshots.where("docId").equals(d.id).primaryKeys();
      await db.snapshots.where("docId").equals(d.id).delete();
      await addTombstones("snapshots", snaps as string[]);
    }
    await db.docs.where("workId").equals(workId).delete();
    await db.entities.where("workId").equals(workId).delete();
    await db.sprints.where("workId").equals(workId).delete();
    await db.progress.delete(workId);
    const ills = (await db.illustrations.where("workId").equals(workId).primaryKeys()) as string[];
    await db.illustrations.where("workId").equals(workId).delete();
    await addTombstones("illustrations", ills);
    await db.works.delete(workId);
    await addTombstones("docs", docs.map((d) => d.id));
    await addTombstones("entities", entities.map((e) => e.id));
    await addTombstones("sprints", sprints.map((s) => s.id));
    await addTombstones("works", [workId]);
  });
}

export async function deleteDoc(docId: string) {
  await db.transaction("rw", [db.docs, db.snapshots, db.tombstones, db.illustrations], async () => {
    const snaps = (await db.snapshots.where("docId").equals(docId).primaryKeys()) as string[];
    const ills = (await db.illustrations.where("docId").equals(docId).primaryKeys()) as string[];
    await db.snapshots.where("docId").equals(docId).delete();
    await db.illustrations.where("docId").equals(docId).delete();
    await db.docs.delete(docId);
    await addTombstones("snapshots", snaps);
    await addTombstones("illustrations", ills);
    await addTombstones("docs", [docId]);
  });
}

export async function deleteEntity(id: string) {
  await db.entities.delete(id);
  await addTombstones("entities", [id]);
}

export async function forkDoc(docId: string, label: string): Promise<Doc> {
  const src = await db.docs.get(docId);
  if (!src) throw new Error("Document not found");
  return createDoc(src.workId, `${src.title} · ${label}`, {
    html: src.html,
    text: src.text,
    wordCount: src.wordCount,
    parentId: src.id,
    forkLabel: label,
    order: src.order + 0.5,
    goal: src.goal,
  });
}

export async function saveProgress(workId: string, docId: string, scroll: number) {
  await db.progress.put({ workId, docId, scroll, updatedAt: Date.now() });
}

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Full export of everything, as one JSON document. */
export async function exportBackup() {
  const [works, docs, entities, snapshots, sprints, progress, profile] = await Promise.all([
    db.works.toArray(),
    db.docs.toArray(),
    db.entities.toArray(),
    db.snapshots.toArray(),
    db.sprints.toArray(),
    db.progress.toArray(),
    getProfile(),
  ]);
  return { format: "storyforge-backup", version: 2, exportedAt: Date.now(), works, docs, entities, snapshots, sprints, progress, profile };
}

export async function importBackup(json: unknown) {
  const data = json as Awaited<ReturnType<typeof exportBackup>>;
  if (!data || data.format !== "storyforge-backup") throw new Error("Not a StoryForge backup file");
  await db.transaction("rw", [db.works, db.docs, db.entities, db.snapshots, db.sprints, db.progress, db.settings], async () => {
    await db.works.bulkPut((data.works ?? []).map((w) => ({ rating: "everyone", ships: [], tags: [], warnings: [], heat: 0, ...(w as Partial<Work>) }) as Work));
    await db.docs.bulkPut(data.docs ?? []);
    await db.entities.bulkPut(data.entities ?? []);
    await db.snapshots.bulkPut(data.snapshots ?? []);
    await db.sprints.bulkPut(data.sprints ?? []);
    await db.progress.bulkPut(data.progress ?? []);
    if (data.profile) await db.settings.put({ key: PROFILE_KEY, value: data.profile });
  });
  return { works: data.works?.length ?? 0, docs: data.docs?.length ?? 0 };
}
