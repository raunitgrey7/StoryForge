"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, PenLine } from "lucide-react";
import * as THREE from "three";
import { db } from "@/lib/db";
import type { Doc, Entity, Work } from "@/lib/types";
import { craftOf } from "@/lib/crafts";
import { KIND_META } from "@/lib/entities";
import { seedDemo } from "@/lib/demo";
import { AtlasScene, layoutAtlas, type AtlasNode, type AtlasSelection } from "./AtlasScene";
import { Button } from "@/components/ui/primitives";

const NO_DOCS: Doc[] = [];
const NO_ENTITIES: Entity[] = [];

export function Atlas() {
  const router = useRouter();
  const works = useLiveQuery(() => db.works.toArray(), []);
  const docs = useLiveQuery(() => db.docs.toArray(), []) ?? NO_DOCS;
  const entities = useLiveQuery(() => db.entities.toArray(), []) ?? NO_ENTITIES;
  const [selected, setSelected] = useState<AtlasSelection>(null);
  const [hover, setHover] = useState<AtlasNode | null>(null);
  const [fly, setFly] = useState<THREE.Vector3 | null>(null);
  const [seeding, setSeeding] = useState(false);

  const nodes = useMemo(() => layoutAtlas(works ?? [], docs, entities), [works, docs, entities]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const sel = selected ? byId.get(selected.id) : undefined;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  function select(n: AtlasNode | null) {
    if (!n) {
      setSelected(null);
      return;
    }
    setSelected({ type: n.type, id: n.id });
    setFly(new THREE.Vector3(...n.position));
  }

  function open(n: AtlasNode) {
    if (n.type === "doc") router.push(`/studio?doc=${n.id}`);
    else if (n.type === "work") router.push(`/studio?work=${n.id}`);
    else {
      const e = entities.find((x) => x.id === n.id);
      const first = e?.docIds[0];
      router.push(first ? `/studio?doc=${first}` : `/studio?work=${n.workId}`);
    }
  }

  const stats = useMemo(() => {
    const w = docs.reduce((n, d) => n + d.wordCount, 0);
    return { works: works?.length ?? 0, docs: docs.length, entities: entities.length, words: w };
  }, [works, docs, entities]);

  if (works && works.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0c0a1f] px-6 text-center text-[#ede8ff]">
        <h1 className="font-display text-4xl font-medium">An empty sky.</h1>
        <p className="mt-3 max-w-md text-[#b9b1e0]">The atlas draws itself from your work. Write something in the studio, or load the demo universe to see how it looks with a novel, a poetry collection and a blog.</p>
        <div className="mt-6 flex gap-3">
          <Button tone="gold" onClick={() => router.push("/studio")}>
            Open the studio
          </Button>
          <Button
            onClick={async () => {
              setSeeding(true);
              await seedDemo();
              setSeeding(false);
            }}
            disabled={seeding}
          >
            {seeding ? "Loading…" : "Load the demo universe"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0c0a1f] text-[#ede8ff]">
      <AtlasScene nodes={nodes} selected={selected} onSelect={select} onOpen={open} onHover={setHover} flyTarget={fly} />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link href="/studio" className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-[#120f2a]/70 px-3 text-sm backdrop-blur hover:bg-white/5">
            <ArrowLeft size={15} /> Studio
          </Link>
          <div className="rounded-[10px] border border-white/10 bg-[#120f2a]/70 px-3 py-1.5 backdrop-blur">
            <div className="font-display text-lg font-medium leading-tight">Atlas</div>
            <div className="text-[11px] text-[#b9b1e0]">
              {stats.works} works · {stats.docs} pieces · {stats.entities} bible entries · {stats.words.toLocaleString()} words
            </div>
          </div>
        </div>
        <div className="pointer-events-auto rounded-[10px] border border-white/10 bg-[#120f2a]/70 px-3 py-2 text-[11px] text-[#b9b1e0] backdrop-blur">
          <div>Drag to orbit · scroll to zoom · click to focus · double-click to open</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: `oklch(0.78 0.14 ${KIND_META[k].hue})` }} /> {KIND_META[k].plural}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[oklch(0.8_0.12_300)]" /> Branches
            </span>
          </div>
        </div>
      </div>

      {/* Works list */}
      <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-[60vw] flex-wrap gap-1.5">
        {(works ?? []).map((w) => {
          const n = byId.get(w.id);
          const active = selected?.id === w.id || (sel && sel.workId === w.id);
          return (
            <button
              key={w.id}
              onClick={() => n && select(n)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
                active ? "border-white/30 bg-white/10" : "border-white/10 bg-[#120f2a]/70 hover:bg-white/5"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: `oklch(0.82 0.16 ${w.hue})` }} />
              {w.title}
              <span className="text-[#7f78ab]">{craftOf(w.craft).label}</span>
            </button>
          );
        })}
      </div>

      {/* Hover hint */}
      {hover && !sel && (
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-[10px] border border-white/10 bg-[#120f2a]/80 px-3 py-2 text-xs backdrop-blur">
          <div className="font-medium">{hover.label}</div>
          <div className="text-[#b9b1e0]">{hover.meta}</div>
        </div>
      )}

      {/* Selection card */}
      {sel && (
        <aside className="sf-enter pointer-events-auto absolute right-4 top-24 w-[320px] rounded-[14px] border border-white/10 bg-[#120f2a]/85 p-4 backdrop-blur">
          <SelectionCard node={sel} docs={docs} entities={entities} works={works ?? []} onFly={(id) => { const n = byId.get(id); if (n) select(n); }} onOpen={() => open(sel)} />
        </aside>
      )}
    </div>
  );
}

function SelectionCard({
  node,
  docs,
  entities,
  works,
  onFly,
  onOpen,
}: {
  node: AtlasNode;
  docs: Doc[];
  entities: Entity[];
  works: Work[];
  onFly: (id: string) => void;
  onOpen: () => void;
}) {
  if (node.type === "work") {
    const w = works.find((x) => x.id === node.id);
    const wdocs = docs.filter((d) => d.workId === node.id && !d.parentId).sort((a, b) => a.order - b.order);
    const cast = entities.filter((e) => e.workId === node.id && e.kind === "character").sort((a, b) => b.mentions - a.mentions).slice(0, 6);
    return (
      <>
        <div className="text-[11px] text-[#b9b1e0]">{craftOf(w?.craft).label}</div>
        <h2 className="font-display text-2xl font-medium leading-tight">{node.label}</h2>
        {w?.logline && <p className="mt-1 text-xs italic text-[#b9b1e0]">{w.logline}</p>}
        <p className="mt-1 text-[11px] text-[#7f78ab]">{node.meta}</p>
        <ul className="mt-3 max-h-40 space-y-0.5 overflow-y-auto">
          {wdocs.map((d) => (
            <li key={d.id}>
              <button onClick={() => onFly(d.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-white/5">
                <span className="truncate">{d.title}</span>
                <span className="text-[#7f78ab]">{d.wordCount.toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
        {cast.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {cast.map((c) => (
              <button key={c.id} onClick={() => onFly(c.id)} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/5">
                {c.name}
              </button>
            ))}
          </div>
        )}
        <Button tone="gold" size="sm" className="mt-4 w-full" onClick={onOpen} icon={<PenLine size={13} />}>
          Open in the studio
        </Button>
      </>
    );
  }
  if (node.type === "doc") {
    const d = docs.find((x) => x.id === node.id);
    const here = entities.filter((e) => e.docIds.includes(node.id)).sort((a, b) => b.mentions - a.mentions).slice(0, 10);
    return (
      <>
        <div className="text-[11px] text-[#b9b1e0]">{d?.forkLabel ? "Branch" : "Piece"}</div>
        <h2 className="font-display text-xl font-medium leading-tight">{d?.title ?? node.label}</h2>
        <p className="mt-1 text-[11px] text-[#7f78ab]">{node.meta}</p>
        {d?.goal && <p className="mt-2 text-xs italic text-[#b9b1e0]">{d.goal}</p>}
        {d?.text && <p className="mt-2 line-clamp-4 font-display text-[13px] leading-relaxed text-[#ede8ff]/85">{d.text.slice(0, 320)}</p>}
        {here.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {here.map((e) => (
              <button key={e.id} onClick={() => onFly(e.id)} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/5" style={{ borderColor: `oklch(0.78 0.14 ${KIND_META[e.kind].hue} / 0.5)` }}>
                {e.name}
              </button>
            ))}
          </div>
        )}
        <Button tone="gold" size="sm" className="mt-4 w-full" onClick={onOpen} icon={<PenLine size={13} />}>
          Write in this piece
        </Button>
      </>
    );
  }
  const e = entities.find((x) => x.id === node.id);
  const appears = docs.filter((d) => e?.docIds.includes(d.id));
  return (
    <>
      <div className="text-[11px]" style={{ color: `oklch(0.78 0.14 ${KIND_META[e?.kind ?? "character"].hue})` }}>{KIND_META[e?.kind ?? "character"].label}</div>
      <h2 className="font-display text-xl font-medium leading-tight">{node.label}</h2>
      <p className="mt-1 text-[11px] text-[#7f78ab]">{node.meta}</p>
      {e?.description && <p className="mt-2 text-xs leading-relaxed text-[#b9b1e0]">{e.description}</p>}
      <div className="mt-3 text-[11px] text-[#7f78ab]">Appears in</div>
      <ul className="mt-1 space-y-0.5">
        {appears.map((d) => (
          <li key={d.id}>
            <button onClick={() => onFly(d.id)} className="w-full truncate rounded-md px-2 py-1 text-left text-xs hover:bg-white/5">
              {d.title}
            </button>
          </li>
        ))}
      </ul>
      <Button tone="gold" size="sm" className="mt-4 w-full" onClick={onOpen} icon={<PenLine size={13} />}>
        Go to the first appearance
      </Button>
    </>
  );
}

