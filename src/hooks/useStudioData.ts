"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useUI } from "@/lib/store";
import { craftOf } from "@/lib/crafts";
import type { Doc, Entity } from "@/lib/types";

export function useStudioData() {
  const workId = useUI((s) => s.workId);
  const docId = useUI((s) => s.docId);

  const works = useLiveQuery(() => db.works.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const work = useLiveQuery(() => (workId ? db.works.get(workId) : undefined), [workId]);
  const docs = useLiveQuery(() => (workId ? db.docs.where("workId").equals(workId).sortBy("order") : Promise.resolve([] as Doc[])), [workId]) ?? [];
  const doc = useLiveQuery(() => (docId ? db.docs.get(docId) : undefined), [docId]);
  const entities = useLiveQuery(() => (workId ? db.entities.where("workId").equals(workId).toArray() : Promise.resolve([] as Entity[])), [workId]) ?? [];
  const craft = craftOf(work?.craft);
  const loading = works === undefined;

  return { works, work, docs, doc, entities, craft, loading };
}
