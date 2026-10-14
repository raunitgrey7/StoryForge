"use client";

import { useState } from "react";
import { FileDown, X } from "lucide-react";
import { downloadPdf, PAGE_STYLES, PAPERS, type PageStyleId, type PaperId } from "@/lib/pdf";
import { illustrationsFor } from "@/lib/illustrate";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Doc, Work } from "@/lib/types";
import { Button, Input, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

const PREVIEW_FONT: Record<PageStyleId, string> = {
  classic: '"EB Garamond", Georgia, serif',
  modern: '"Literata", Georgia, serif',
  manuscript: '"Courier Prime", "Courier New", monospace',
  gothic: '"Cormorant Garamond", Georgia, serif',
  reader: '"Literata", Georgia, serif',
};

/** Pick a page style and font, then get a real PDF file. */
export function PdfDialog({ work, docs, open, onClose }: { work: Work; docs: Doc[]; open: boolean; onClose: () => void }) {
  const [style, setStyle] = useState<PageStyleId>("classic");
  const [paper, setPaper] = useState<PaperId>("aged");
  const [withImages, setWithImages] = useState(true);
  const illCount = useLiveQuery(() => db.illustrations.where("workId").equals(work.id).count(), [work.id]) ?? 0;
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!open) return null;

  async function go() {
    setBusy("Preparing");
    try {
      const illustrations = withImages ? await illustrationsFor(work.id) : undefined;
      await downloadPdf(work, docs, { style, paper, author: author.trim() || undefined, illustrations, onProgress: setBusy });
      toast("PDF ready", `${work.title}, ${PAGE_STYLES.find((s) => s.id === style)?.label}.`, "success");
      onClose();
    } catch (e) {
      toast("Could not build the PDF", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-bg-deep/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Literata:ital@0;1&family=Courier+Prime&family=Cormorant+Garamond:ital@0;1&display=swap");`}</style>
      <div className="sf-enter max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[18px] border border-line bg-surface p-5 shadow-2xl sm:rounded-[16px] sm:p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium">Download as PDF</h2>
            <p className="mt-1 text-sm text-ink-2">A real, typeset PDF with the font embedded. Pick the edition.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {PAGE_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`flex gap-3 rounded-[12px] border p-3 text-left transition-colors ${style === s.id ? "border-gold bg-gold/10" : "border-line hover:border-line-2"}`}
            >
              <div
                className="flex h-20 w-14 shrink-0 flex-col justify-center rounded-[4px] border border-line-2 px-1.5 text-[7px] leading-[1.35]"
                style={{ fontFamily: PREVIEW_FONT[s.id], background: s.paper ? `rgb(${s.paper.join(",")})` : "#fffdf8", color: `rgb(${s.ink.join(",")})` }}
              >
                <div className="mb-1 text-center text-[8px]">{s.ornament}</div>
                <div>{s.dropCap ? <span className="float-left mr-0.5 text-[16px] leading-[0.9]">T</span> : null}he letter arrived folded into the shape of a bird. She unfolded it on the drafting table.</div>
              </div>
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{s.blurb}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Paper</span>
          <div className="flex flex-wrap gap-1.5">
            {PAPERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaper(p.id)}
                data-tip={p.blurb}
                data-tip-side="bottom"
                data-tip-align="start"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${paper === p.id ? "border-gold bg-gold/10 text-ink" : "border-line text-ink-2 hover:border-line-2"}`}
              >
                <span className="h-4 w-4 rounded-sm border border-line-2" style={{ background: p.id === "aged" ? "radial-gradient(circle at 50% 50%, #f4e6c6 0%, #e9d3a3 60%, #c9a56d 100%)" : p.id === "cream" ? "#f8f1de" : "#ffffff" }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} className="accent-[var(--gold)]" disabled={illCount === 0} />
          <span className={illCount === 0 ? "text-ink-3" : ""}>
            Place illustrations at chapter heads{illCount === 0 ? " (none yet; illustrate chapters from the reader)" : ` (${illCount})`}
          </span>
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Author line on the title page (optional)</span>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name or pen name" />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="gold" onClick={go} disabled={busy !== null} icon={busy ? <Spinner /> : <FileDown size={15} />}>
            {busy ?? "Download PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
