"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, snapshotDoc } from "@/lib/db";
import { useUI, type DockTab } from "@/lib/store";
import { craftOf } from "@/lib/crafts";
import { toast } from "@/components/ui/Toast";
import type { Doc, Work } from "@/lib/types";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

const NO_WORKS: Work[] = [];
const NO_DOCS: Doc[] = [];

export function CommandPalette({ onNewWork }: { onNewWork: () => void }) {
  const open = useUI((s) => s.paletteOpen);
  if (!open) return null;
  return <Palette onNewWork={onNewWork} />;
}

function Palette({ onNewWork }: { onNewWork: () => void }) {
  const ui = useUI();
  const router = useRouter();
  const [q, setQState] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const setQ = (v: string) => {
    setQState(v);
    setCursor(0);
  };

  const works = useLiveQuery(() => db.works.toArray(), []) ?? NO_WORKS;
  const docs = useLiveQuery(() => db.docs.toArray(), []) ?? NO_DOCS;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, []);

  const items = useMemo<Item[]>(() => {
    const close = () => ui.setPalette(false);
    const tab = (t: DockTab, label: string): Item => ({
      id: `tab-${t}`,
      group: "Panels",
      label,
      run: () => {
        ui.setDockTab(t);
        close();
      },
    });
    const actions: Item[] = [
      { id: "new", group: "Actions", label: "Start a new work", run: () => { close(); onNewWork(); } },
      { id: "commission", group: "Actions", label: "Commission a story", hint: "You write the brief, it gets written", run: () => { close(); router.push("/commission"); } },
      { id: "atlas", group: "Actions", label: "Open the atlas", hint: "3D view of everything", run: () => { close(); router.push("/atlas"); } },
      { id: "focus", group: "Actions", label: ui.focusMode ? "Leave focus mode" : "Enter focus mode", hint: "Ctrl Shift F", run: () => { ui.toggleFocus(); close(); } },
      { id: "snap", group: "Actions", label: "Save a snapshot", hint: "Ctrl S", run: () => { if (ui.docId) snapshotDoc(ui.docId, "Manual snapshot").then(() => toast("Snapshot saved")); close(); } },
      { id: "theme", group: "Actions", label: ui.theme === "dark" ? "Switch to light chrome" : "Switch to dark chrome", run: () => { ui.setTheme(ui.theme === "dark" ? "light" : "dark"); close(); } },
      tab("companion", "Companion"),
      tab("muse", "Muse"),
      tab("pulse", "Pulse"),
      tab("bible", "Story bible"),
      tab("forks", "Forks"),
      tab("history", "History"),
      tab("sprint", "Sprint"),
    ];
    const docItems: Item[] = docs.map((d) => {
      const w = works.find((x) => x.id === d.workId);
      return {
        id: d.id,
        group: w ? `${w.title} · ${craftOf(w.craft).unitPlural}` : "Documents",
        label: d.title,
        hint: `${d.wordCount.toLocaleString()} words`,
        run: () => {
          ui.setWork(d.workId);
          ui.setDoc(d.id);
          close();
        },
      };
    });
    return [...actions, ...docItems];
  }, [docs, works, ui, onNewWork, router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 40);
    return items
      .map((it) => ({ it, score: score(s, `${it.label} ${it.group} ${it.hint ?? ""}`.toLowerCase()) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.it);
  }, [q, items]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-bg-deep/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => ui.setPalette(false)}>
      <div className="sf-enter w-full max-w-xl overflow-hidden rounded-[14px] border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(filtered.length - 1, c + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
            if (e.key === "Enter") { e.preventDefault(); filtered[cursor]?.run(); }
            if (e.key === "Escape") ui.setPalette(false);
          }}
          placeholder="Jump to a chapter, a poem, a panel, an action…"
          className="h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none placeholder:text-ink-3"
        />
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-ink-3">Nothing matches.</div>}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => setCursor(i)}
              onClick={it.run}
              className={`flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left ${i === cursor ? "bg-gold/12 text-ink" : "text-ink-2"}`}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{it.label}</span>
              <span className="truncate text-[11px] text-ink-3">{it.hint ?? it.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function score(q: string, hay: string): number {
  if (hay.includes(q)) return 100 - hay.indexOf(q);
  let i = 0;
  let s = 0;
  for (const ch of hay) {
    if (ch === q[i]) {
      s += 2;
      i++;
      if (i === q.length) return s;
    }
  }
  return 0;
}
