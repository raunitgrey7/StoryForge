"use client";

import { useMemo, useState } from "react";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { db, deleteEntity, uid } from "@/lib/db";
import { KIND_META, relinkEntities, upsertEntities } from "@/lib/entities";
import { companionJson } from "@/lib/ai/client";
import { useCompanionContext } from "@/hooks/useCompanionContext";
import { useUI } from "@/lib/store";
import type { Entity, EntityKind } from "@/lib/types";
import { Button, Empty, Input, Pill, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

interface Continuity {
  score: number;
  issues: { severity: "low" | "medium" | "high"; about: string; quote: string; conflict: string; fix: string }[];
  praise: string[];
}

export function BiblePanel() {
  const ui = useUI();
  const { work, doc, docs, entities, craft } = useCompanionContext();
  const [busy, setBusy] = useState<"extract" | "check" | null>(null);
  const [report, setReport] = useState<Continuity | null>(null);
  const [adding, setAdding] = useState<EntityKind | null>(null);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState<"all" | "here">("all");

  const grouped = useMemo(() => {
    const src = filter === "here" && doc ? entities.filter((e) => e.docIds.includes(doc.id)) : entities;
    const g: Record<EntityKind, Entity[]> = { character: [], place: [], object: [], theme: [], fact: [] };
    for (const e of src) g[e.kind].push(e);
    for (const k of Object.keys(g) as EntityKind[]) g[k].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.mentions - a.mentions);
    return g;
  }, [entities, filter, doc]);

  const missingHere = useMemo(() => {
    if (!doc) return [];
    return entities.filter((e) => e.kind === "character" && e.mentions > 2 && !e.docIds.includes(doc.id)).slice(0, 4);
  }, [entities, doc]);

  async function extract() {
    if (!work) return;
    setBusy("extract");
    try {
      const text = (doc ? [doc, ...docs.filter((d) => d.id !== doc.id)] : docs).map((d) => `# ${d.title}\n${d.text}`).join("\n\n").slice(0, 55_000);
      const res = await companionJson<{ entities: { kind: EntityKind; name: string; aliases: string[]; description: string; traits: string[] }[] }>({
        task: "entities",
        craft: craft.id,
        workTitle: work.title,
        logline: work.logline,
        text,
        bible: entities.map((e) => ({ kind: e.kind, name: e.name, description: e.description, traits: e.traits })),
      });
      const r = await upsertEntities(work.id, res.entities);
      toast("Bible updated", `${r.added} new, ${r.merged} merged.`, "success");
    } catch (e) {
      toast("Could not read the text", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    if (!work || !doc) return;
    setBusy("check");
    setReport(null);
    try {
      const res = await companionJson<Continuity>({
        task: "continuity",
        craft: craft.id,
        workTitle: work.title,
        logline: work.logline,
        text: doc.text.slice(0, 55_000),
        bible: entities.map((e) => ({ kind: e.kind, name: e.name, description: e.description, traits: e.traits })),
      });
      setReport(res);
    } catch (e) {
      toast("Could not run the check", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!work || !adding || !newName.trim()) return;
    const now = Date.now();
    await db.entities.add({
      id: uid("e"),
      workId: work.id,
      kind: adding,
      name: newName.trim(),
      aliases: [],
      description: "",
      traits: [],
      docIds: [],
      mentions: 0,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    await relinkEntities(work.id);
    setNewName("");
    setAdding(null);
  }

  if (!work) {
    return (
      <div className="p-4">
        <Empty title="No work open" body="The story bible belongs to a work. Open one from the rail." />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-display text-lg font-medium">Story bible</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Who and what must stay consistent. Mentions are counted on your device; the companion reads the bible before every suggestion.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" tone="aurora" onClick={extract} disabled={busy !== null || docs.length === 0} icon={busy === "extract" ? <Spinner /> : undefined}>
          Read the text for entities
        </Button>
        <Button size="sm" onClick={check} disabled={busy !== null || !doc || doc.wordCount < 50} icon={busy === "check" ? <Spinner /> : undefined}>
          Check continuity
        </Button>
      </div>

      {missingHere.length > 0 && doc && (
        <p className="rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px] leading-snug text-ink-2">
          Not in this {craft.unitLabel.toLowerCase()} yet: {missingHere.map((e) => e.name).join(", ")}. Deliberate?
        </p>
      )}

      {report && (
        <section className="sf-enter rounded-[12px] border border-line p-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Continuity</h3>
            <span className={`font-display text-2xl ${report.score >= 80 ? "text-aurora" : report.score >= 55 ? "text-gold" : "text-ember"}`}>{Math.round(report.score)}</span>
          </div>
          {report.issues.length === 0 && <p className="mt-1 text-xs text-ink-2">No contradictions found in this piece.</p>}
          <ul className="mt-2 space-y-2">
            {report.issues.map((it, i) => (
              <li key={i} className="rounded-[8px] bg-surface-2 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${it.severity === "high" ? "bg-ember" : it.severity === "medium" ? "bg-gold" : "bg-lilac"}`} />
                  <span className="font-medium">{it.about}</span>
                </div>
                <p className="mt-1 italic text-ink-2">“{it.quote}”</p>
                <p className="mt-1 text-ink-2">{it.conflict}</p>
                <p className="mt-1 text-aurora">{it.fix}</p>
              </li>
            ))}
          </ul>
          {report.praise.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-[11px] text-ink-3">
              {report.praise.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-[8px] border border-line p-0.5">
          {(["all", "here"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-[6px] px-2 py-1 text-[11px] ${filter === f ? "bg-surface-2 text-ink" : "text-ink-3"}`}>
              {f === "all" ? "Whole work" : `This ${craft.unitLabel.toLowerCase()}`}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-ink-3">{entities.length} entries</span>
      </div>

      {entities.length === 0 && (
        <Empty
          title="Empty bible"
          body="Ask the companion to read the text, or add entries by hand. Names are matched against every piece in the work."
        />
      )}

      {(Object.keys(grouped) as EntityKind[]).map((kind) => {
        const list = grouped[kind];
        if (list.length === 0 && filter === "here") return null;
        return (
          <section key={kind}>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-medium text-ink-2">{KIND_META[kind].plural}</h3>
              <button onClick={() => setAdding(adding === kind ? null : kind)} className="rounded p-1 text-ink-3 hover:text-ink" aria-label={`Add ${kind}`}>
                <Plus size={13} />
              </button>
            </div>
            {adding === kind && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
                className="mb-2 flex gap-1"
              >
                <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${kind}`} className="h-8 text-xs" />
                <Button size="sm" type="submit">
                  Add
                </Button>
              </form>
            )}
            <ul className="space-y-1">
              {list.map((e) => (
                <EntityRow key={e.id} e={e} onOpenDoc={(id) => ui.setDoc(id)} docTitle={(id) => docs.find((d) => d.id === id)?.title ?? ""} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EntityRow({ e, onOpenDoc, docTitle }: { e: Entity; onOpenDoc: (id: string) => void; docTitle: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState(e.description);
  const hue = KIND_META[e.kind].hue;
  return (
    <li className="rounded-[10px] border border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `oklch(0.72 0.14 ${hue})` }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{e.name}</span>
        {e.pinned && <Pin size={11} className="text-gold" />}
        <span className="text-[10px] tabular-nums text-ink-3">{e.mentions}×</span>
      </button>
      {open && (
        <div className="sf-enter space-y-2 border-t border-line px-2.5 py-2">
          <textarea
            value={desc}
            onChange={(ev) => setDesc(ev.target.value)}
            onBlur={() => desc !== e.description && db.entities.update(e.id, { description: desc, updatedAt: Date.now() })}
            rows={2}
            placeholder="What must stay true about this?"
            className="w-full resize-none rounded-[8px] border border-line bg-surface px-2 py-1.5 text-xs leading-snug"
          />
          {e.aliases.length > 0 && <p className="text-[11px] text-ink-3">Also called: {e.aliases.join(", ")}</p>}
          {e.traits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {e.traits.map((t) => (
                <Pill key={t} hue={hue}>
                  {t}
                </Pill>
              ))}
            </div>
          )}
          {e.docIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {e.docIds.map((id) => (
                <button key={id} onClick={() => onOpenDoc(id)} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-ink">
                  {docTitle(id) || "…"}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => db.entities.update(e.id, { pinned: !e.pinned })} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-ink-3 hover:text-ink">
              {e.pinned ? <PinOff size={11} /> : <Pin size={11} />} {e.pinned ? "Unpin" : "Pin for the companion"}
            </button>
            <button onClick={() => deleteEntity(e.id)} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-ink-3 hover:text-ember">
              <Trash2 size={11} /> Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
