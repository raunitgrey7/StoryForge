"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpenText, ChevronDown, ChevronRight, Download, GitBranch, Moon, Orbit, Plus, Settings2, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import { createDoc, deleteDoc, deleteWork, exportBackup, importBackup } from "@/lib/db";
import { craftOf } from "@/lib/crafts";
import { useUI } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { RATING_META, type Doc, type Work } from "@/lib/types";
import { exportDocx, exportHtml, exportMarkdown, exportText, downloadJson } from "@/lib/export";
import { toast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/primitives";
import { AccountMenu } from "@/components/account/AccountMenu";

export function Rail({
  works,
  docs,
  onNewWork,
  onSettings,
  onPick,
}: {
  works: Work[];
  docs: Doc[];
  onNewWork: () => void;
  onSettings: (w: Work) => void;
  /** Called after a document is chosen (mobile closes the drawer). */
  onPick?: () => void;
}) {
  const ui = useUI(useShallow((s) => ({ workId: s.workId, docId: s.docId, theme: s.theme, setWork: s.setWork, setDoc: s.setDoc, setTheme: s.setTheme })));
  const [exportOpen, setExportOpen] = useState(false);

  const work = works.find((w) => w.id === ui.workId);
  const craft = craftOf(work?.craft);

  async function addDoc() {
    if (!work) return;
    const d = await createDoc(work.id, `${craft.unitLabel} ${docs.length + 1}`);
    ui.setDoc(d.id);
    onPick?.();
  }

  async function removeDoc(d: Doc) {
    if (!confirm(`Delete "${d.title}"? This also removes its history.`)) return;
    await deleteDoc(d.id);
    if (ui.docId === d.id) ui.setDoc(null);
    toast("Deleted", d.title);
  }

  async function removeWork(w: Work) {
    if (!confirm(`Delete "${w.title}" and everything in it?`)) return;
    await deleteWork(w.id);
    if (ui.workId === w.id) {
      ui.setWork(null);
      ui.setDoc(null);
    }
    toast("Deleted", w.title);
  }

  async function doExport(kind: "md" | "docx" | "html" | "txt") {
    if (!work) return;
    const ordered = [...docs].sort((a, b) => a.order - b.order);
    try {
      if (kind === "md") exportMarkdown(work, ordered);
      if (kind === "html") exportHtml(work, ordered);
      if (kind === "txt") exportText(work, ordered);
      if (kind === "docx") await exportDocx(work, ordered);
      toast("Exported", `${work.title} as ${kind.toUpperCase()}`, "success");
    } catch (e) {
      toast("Export failed", (e as Error).message, "error");
    }
    setExportOpen(false);
  }

  async function backup() {
    const data = await exportBackup();
    downloadJson(data, `storyforge-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast("Backup downloaded", "Keep it somewhere safe.", "success");
  }

  function restore() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const res = await importBackup(JSON.parse(await f.text()));
        toast("Restored", `${res.works} works, ${res.docs} documents`, "success");
      } catch (e) {
        toast("Restore failed", (e as Error).message, "error");
      }
    };
    input.click();
  }

  const roots = docs.filter((d) => !d.parentId);
  const forksOf = (id: string) => docs.filter((d) => d.parentId === id);
  const pick = (id: string) => {
    ui.setDoc(id);
    onPick?.();
  };

  return (
    <div className="flex h-full w-full flex-col lg:w-[272px]">
      <div className="flex items-center justify-between px-3 pt-3">
        <Link href="/" className="font-display px-1 text-lg font-semibold tracking-tight">
          StoryForge
        </Link>
        <div className="flex items-center">
          <Link href="/atlas" className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-2 hover:bg-surface-2 hover:text-ink" data-tip="The atlas: everything you have written as a sky you can fly through." data-tip-side="bottom" data-tip-align="end">
            <Orbit size={17} />
          </Link>
          <IconButton label={ui.theme === "dark" ? "Switch the chrome to light. The page stays paper either way." : "Switch the chrome to dark."} onClick={() => ui.setTheme(ui.theme === "dark" ? "light" : "dark")}>
            {ui.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
        </div>
      </div>

      <Link
        href="/commission"
        data-tip="Commission a piece: you choose the form, heat, language and length, write the whole idea, and it is written and saved for you."
        data-tip-side="bottom"
        data-tip-align="start"
        className="mx-3 mt-3 flex items-center gap-2 rounded-[10px] border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-ink hover:bg-gold/15"
      >
        <Sparkles size={15} className="text-gold" /> Commission a story
      </Link>

      <div className="mt-3 flex items-center justify-between px-4">
        <span className="text-xs font-medium text-ink-3">Works</span>
        <button onClick={onNewWork} data-tip="Start a new work: pick the craft, the rating, and optionally let the companion seed it." data-tip-side="bottom" data-tip-align="end" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-gold hover:bg-gold/10">
          <Plus size={13} /> New
        </button>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-2 pb-3">
        {works.length === 0 && <p className="px-2 py-3 text-xs leading-relaxed text-ink-3">Nothing here yet. Start a work or load the demo universe.</p>}
        {works.map((w) => {
          const open = w.id === ui.workId;
          const c = craftOf(w.craft);
          return (
            <div key={w.id} className="mb-1">
              <div className={`group flex items-center gap-1 rounded-[10px] px-2 py-1.5 ${open ? "bg-surface-2" : "hover:bg-surface-2/60"}`}>
                <button
                  onClick={() => {
                    ui.setWork(open ? null : w.id);
                    ui.setDoc(null);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `oklch(0.75 0.15 ${w.hue})` }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.title}</span>
                  {w.rating !== "everyone" && (
                    <span className={`rounded px-1 text-[9px] font-semibold ${w.rating === "explicit" ? "bg-ember/15 text-ember" : w.rating === "mature" ? "bg-gold/15 text-gold" : "bg-surface text-ink-3"}`} title={RATING_META[w.rating].label}>
                      {RATING_META[w.rating].short}
                    </span>
                  )}
                  <span className="hidden text-[10px] text-ink-3 sm:inline">{c.label}</span>
                  {open ? <ChevronDown size={14} className="text-ink-3" /> : <ChevronRight size={14} className="text-ink-3" />}
                </button>
              </div>

              {open && (
                <div className="ml-3 mt-1 border-l border-line pl-2">
                  <div className="mb-1 flex items-center gap-0.5 px-1">
                    <button onClick={() => onSettings(w)} data-tip="Title, logline, rating, heat, fandom, ships, tags, warnings, word goal." data-tip-side="bottom" data-tip-align="start" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <Settings2 size={12} /> Settings
                    </button>
                    <Link href={`/read/${w.id}`} data-tip="Read this work like a book, with your place saved." data-tip-side="bottom" data-tip-align="start" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <BookOpenText size={12} /> Read
                    </Link>
                    <button onClick={() => removeWork(w)} data-tip="Delete this work and everything in it. Asks first." data-tip-side="bottom" data-tip-align="end" className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-3 hover:text-ember">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {w.fandom && <div className="px-2 pb-1 text-[11px] text-lilac">{w.fandom}{w.ships.length ? ` · ${w.ships.slice(0, 2).join(", ")}` : ""}</div>}
                  {roots.map((d) => (
                    <div key={d.id}>
                      <DocRow doc={d} active={ui.docId === d.id} onOpen={() => pick(d.id)} onDelete={() => removeDoc(d)} />
                      {forksOf(d.id).map((f) => (
                        <div key={f.id} className="ml-3">
                          <DocRow doc={f} fork active={ui.docId === f.id} onOpen={() => pick(f.id)} onDelete={() => removeDoc(f)} />
                        </div>
                      ))}
                    </div>
                  ))}
                  {docs
                    .filter((d) => d.parentId && !docs.some((p) => p.id === d.parentId))
                    .map((d) => (
                      <DocRow key={d.id} doc={d} fork active={ui.docId === d.id} onOpen={() => pick(d.id)} onDelete={() => removeDoc(d)} />
                    ))}
                  <button onClick={addDoc} data-tip="Add a blank piece at the end of this work." className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-ink-3 hover:bg-surface-2 hover:text-ink">
                    <Plus size={12} /> New {c.unitLabel.toLowerCase()}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line p-2">
        <AccountMenu />
        <div className="relative">
          <button
            disabled={!work}
            onClick={() => setExportOpen((o) => !o)}
            data-tip="Download this work as Markdown, Word, a web page or plain text."
            className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <Download size={15} /> <span className="truncate">Export {work ? `“${work.title}”` : ""}</span>
          </button>
          {exportOpen && work && (
            <div className="sf-enter absolute bottom-full left-0 mb-1 w-full rounded-[10px] border border-line bg-surface p-1 shadow-lg">
              {(["md", "docx", "html", "txt"] as const).map((k) => (
                <button key={k} onClick={() => doExport(k)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                  {k === "md" ? "Markdown (.md)" : k === "docx" ? "Word (.docx)" : k === "html" ? "Web page (.html)" : "Plain text (.txt)"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={backup} data-tip="One JSON file with every work, chapter, bible entry and snapshot on this device." className="flex flex-1 items-center gap-2 rounded-[10px] px-2 py-2 text-left text-xs text-ink-3 hover:bg-surface-2 hover:text-ink">
            <Download size={13} /> Backup all
          </button>
          <button onClick={restore} data-tip="Load a backup file. Newer copies win; nothing is wiped." className="flex flex-1 items-center gap-2 rounded-[10px] px-2 py-2 text-left text-xs text-ink-3 hover:bg-surface-2 hover:text-ink">
            <Upload size={13} /> Restore
          </button>
        </div>
      </div>
    </div>
  );
}

function DocRow({ doc, active, fork, onOpen, onDelete }: { doc: Doc; active: boolean; fork?: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className={`group flex items-center gap-1 rounded-md pr-1 ${active ? "bg-gold/10" : "hover:bg-surface-2/70"}`}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left lg:py-1.5">
        {fork && <GitBranch size={11} className="shrink-0 text-lilac" />}
        <span className={`min-w-0 flex-1 truncate text-[13px] ${active ? "font-medium text-ink" : "text-ink-2"}`}>{doc.title}</span>
        <span className="text-[10px] tabular-nums text-ink-3">{doc.wordCount ? doc.wordCount.toLocaleString() : ""}</span>
      </button>
      <button onClick={onDelete} data-tip="Delete this piece and its history. Asks first." className="rounded p-1 text-ink-3 hover:text-ember lg:hidden lg:group-hover:block">
        <Trash2 size={12} />
      </button>
    </div>
  );
}
