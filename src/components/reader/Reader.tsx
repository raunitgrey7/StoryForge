"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, FileDown, Image as ImageIcon, List, Minus, PenLine, Plus } from "lucide-react";
import { illustrate } from "@/lib/illustrate";
import { Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";
import { Listen } from "./Listen";
import { PdfDialog } from "./PdfDialog";
import { useTts } from "@/lib/tts";
import { db, saveProgress } from "@/lib/db";
import { craftOf } from "@/lib/crafts";
import { RATING_META, type Doc } from "@/lib/types";
import { AdultGate } from "@/components/studio/AdultGate";
import { useProfile } from "@/hooks/useProfile";

const NO_DOCS: Doc[] = [];

/**
 * A clean, mobile-first reading view of a work. Progress is saved per work,
 * so a reader (or the writer, rereading) comes back to the same line.
 */
export function Reader({ workId }: { workId: string }) {
  const work = useLiveQuery(() => db.works.get(workId), [workId]);
  const docs = useLiveQuery(() => db.docs.where("workId").equals(workId).sortBy("order"), [workId]) ?? NO_DOCS;
  const progress = useLiveQuery(() => db.progress.get(workId), [workId]);
  const profile = useProfile();
  const [docId, setDocId] = useState<string | null>(null);
  const [toc, setToc] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const spoken = useTts((s) => s.index);
  const speaking = useTts((s) => s.playing);
  const [size, setSizeState] = useState<number>(() => {
    try {
      const s = localStorage.getItem("sf:reader:size");
      return s ? Number(s) || 1.05 : 1.05;
    } catch {
      return 1.05;
    }
  });
  const scroller = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const restoredScroll = useRef(false);

  const chapters = useMemo(() => docs.filter((d) => !d.parentId), [docs]);
  // Until the reader picks a chapter, open where they left off.
  const effectiveId = docId ?? (progress && chapters.some((c) => c.id === progress.docId) ? progress.docId : chapters[0]?.id) ?? null;
  const current = useMemo(() => chapters.find((d) => d.id === effectiveId) ?? chapters[0], [chapters, effectiveId]);
  const index = current ? chapters.indexOf(current) : -1;
  const illustration = useLiveQuery(() => (current ? db.illustrations.where("docId").equals(current.id).first() : undefined), [current?.id]);

  const setSize = (f: (s: number) => number) =>
    setSizeState((s) => {
      const n = f(s);
      try {
        localStorage.setItem("sf:reader:size", String(n));
      } catch {}
      return n;
    });

  // Highlight the paragraph being read aloud and keep it in view.
  useEffect(() => {
    const root = scroller.current?.querySelector(".sf-prose");
    if (!root) return;
    const blocks = Array.from(root.children).filter((el) => (el.textContent ?? "").trim());
    blocks.forEach((el, i) => el.classList.toggle("is-spoken", speaking && i === spoken));
    if (speaking && blocks[spoken]) blocks[spoken].scrollIntoView({ block: "center", behavior: "smooth" });
  }, [spoken, speaking, current]);

  // Restore the scroll position once the saved chapter is on screen.
  useEffect(() => {
    if (restoredScroll.current || !progress || !current || current.id !== progress.docId) return;
    const el = scroller.current;
    if (!el) return;
    restoredScroll.current = true;
    el.scrollTop = progress.scroll * (el.scrollHeight - el.clientHeight);
  }, [progress, current]);

  function onScroll() {
    const el = scroller.current;
    if (!el || !current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const max = el.scrollHeight - el.clientHeight;
      saveProgress(workId, current.id, max > 0 ? el.scrollTop / max : 0);
    }, 400);
  }

  function go(i: number) {
    const d = chapters[i];
    if (!d) return;
    setDocId(d.id);
    setToc(false);
    scroller.current?.scrollTo({ top: 0 });
    saveProgress(workId, d.id, 0);
  }

  if (work === undefined) return null;
  if (!work) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-page px-6 text-center text-[#221c3d]">
        <h1 className="font-display text-2xl">This work is not on this device.</h1>
        <p className="mt-2 text-sm text-[#4b4570]">Sign in on the studio to sync it, or open a different work.</p>
        <Link href="/studio" className="mt-6 rounded-[10px] bg-[#c9971c] px-4 py-2 text-sm font-medium text-[#2a1f02]">
          Open the studio
        </Link>
      </div>
    );
  }

  const adult = work.rating === "mature" || work.rating === "explicit";
  const craft = craftOf(work.craft);
  const verse = work.craft === "poetry" || work.craft === "lyrics";

  return (
    <div className="flex h-[100dvh] flex-col bg-page text-[#221c3d]">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[#eae5f3] bg-[#fbf9f2]/90 px-2 backdrop-blur">
        <Link href={`/studio?work=${work.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4b4570] hover:bg-[#f0ecf9]" aria-label="Back to the studio">
          <ChevronLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{work.title}</div>
          <div className="truncate text-[10px] text-[#8a84ad]">
            {RATING_META[work.rating].label} · {chapters.length} {craft.unitPlural.toLowerCase()}
            {current ? ` · ${index + 1} of ${chapters.length}` : ""}
          </div>
        </div>
        <button onClick={() => setSize((s) => Math.max(0.85, +(s - 0.1).toFixed(2)))} className="h-9 w-9 rounded-[10px] text-[#4b4570] hover:bg-[#f0ecf9]" aria-label="Smaller text">
          <Minus size={16} className="mx-auto" />
        </button>
        <button onClick={() => setSize((s) => Math.min(1.6, +(s + 0.1).toFixed(2)))} className="h-9 w-9 rounded-[10px] text-[#4b4570] hover:bg-[#f0ecf9]" aria-label="Larger text">
          <Plus size={16} className="mx-auto" />
        </button>
        {current && <Listen paragraphs={current.text.split(/\n{2,}|\n/).filter((p) => p.trim())} compact light />}
        {current && (
          <button
            onClick={async () => {
              if (!work || !current) return;
              setDrawing(true);
              try {
                await illustrate(work, current);
                toast("Illustrated", current.title, "success");
              } catch (e) {
                toast("Could not illustrate", (e as Error).message, "error");
              } finally {
                setDrawing(false);
              }
            }}
            disabled={drawing}
            className="h-9 w-9 rounded-[10px] text-[#4b4570] hover:bg-[#f0ecf9] disabled:opacity-50"
            aria-label={illustration ? "Redraw the illustration" : "Illustrate this chapter"}
            data-tip={illustration ? "Draw a new illustration for this chapter from its text." : "Draw an illustration for this chapter from its text. It appears here and in the PDF."}
            data-tip-side="bottom"
            data-tip-align="end"
          >
            {drawing ? <Spinner className="mx-auto" /> : <ImageIcon size={17} className="mx-auto" />}
          </button>
        )}
        <button onClick={() => setPdfOpen(true)} className="h-9 w-9 rounded-[10px] text-[#4b4570] hover:bg-[#f0ecf9]" aria-label="Download as PDF" data-tip="Download this work as a typeset PDF in the edition you choose." data-tip-side="bottom" data-tip-align="end">
          <FileDown size={17} className="mx-auto" />
        </button>
        <button onClick={() => setToc((t) => !t)} className="h-9 w-9 rounded-[10px] text-[#4b4570] hover:bg-[#f0ecf9]" aria-label="Contents">
          <List size={18} className="mx-auto" />
        </button>
        <Link href={current ? `/studio?doc=${current.id}` : `/studio?work=${work.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[#0f9d84] hover:bg-[#0f9d84]/10" aria-label="Edit this chapter">
          <PenLine size={17} />
        </Link>
      </header>

      {toc && (
        <nav className="sf-enter absolute inset-x-0 top-12 z-20 max-h-[70vh] overflow-y-auto border-b border-[#eae5f3] bg-[#fbf9f2] p-2 shadow-lg">
          {chapters.map((c, i) => (
            <button key={c.id} onClick={() => go(i)} className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm ${c.id === current?.id ? "bg-[#c9971c]/15 font-medium" : "hover:bg-[#f0ecf9]"}`}>
              <span className="truncate">{i + 1}. {c.title}</span>
              <span className="text-[11px] text-[#8a84ad]">{c.wordCount.toLocaleString()} w</span>
            </button>
          ))}
        </nav>
      )}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {adult && !profile.adultVerified ? (
          <div className="mx-auto max-w-md px-6 py-16 text-center">
            <h2 className="font-display text-2xl">Rated {RATING_META[work.rating].label}</h2>
            <p className="mt-2 text-sm text-[#4b4570]">{RATING_META[work.rating].blurb}</p>
            <AdultGateInline />
          </div>
        ) : current ? (
          <article className="mx-auto max-w-[42rem] px-4 pb-32 pt-8 sm:px-6" style={{ fontSize: `${size}rem` }}>
            <h1 className="font-display text-[2em] font-medium leading-tight" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 60' }}>
              {current.title}
            </h1>
            {work.warnings.length > 0 && index === 0 && <p className="mt-2 text-[0.8em] text-[#8a84ad]">Content warnings: {work.warnings.join(", ")}</p>}
            {illustration && (
              <figure className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={illustration.dataUrl} alt={illustration.caption} className="w-full rounded-[6px] border border-[#e5dff3] shadow-[0_18px_40px_-24px_rgba(27,23,64,0.5)]" />
              </figure>
            )}
            <div className={`sf-prose mt-6 ${speaking ? "sf-speaking" : ""}`} data-craft={verse ? "poetry" : undefined} style={{ fontSize: "1em", ["--sf-spoken" as string]: spoken }} dangerouslySetInnerHTML={{ __html: current.html || "<p><em>Nothing written here yet.</em></p>" }} />
            <div className="mt-12 flex items-center justify-between border-t border-[#eae5f3] pt-6">
              <button disabled={index <= 0} onClick={() => go(index - 1)} className="inline-flex items-center gap-1 rounded-[10px] px-3 py-2 text-sm text-[#4b4570] hover:bg-[#f0ecf9] disabled:opacity-30">
                <ChevronLeft size={16} /> Previous
              </button>
              <button disabled={index >= chapters.length - 1} onClick={() => go(index + 1)} className="inline-flex items-center gap-1 rounded-[10px] bg-[#c9971c] px-3 py-2 text-sm font-medium text-[#2a1f02] disabled:opacity-30">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </article>
        ) : (
          <div className="px-6 py-16 text-center text-sm text-[#8a84ad]">Nothing to read yet.</div>
        )}
      </div>
      <PdfDialog work={work} docs={chapters} open={pdfOpen} onClose={() => setPdfOpen(false)} />
    </div>
  );
}

function AdultGateInline() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-6 rounded-[10px] bg-[#c9971c] px-4 py-2 text-sm font-medium text-[#2a1f02]">
        I am 18 or older
      </button>
      <AdultGate open={open} onClose={() => setOpen(false)} />
    </>
  );
}
