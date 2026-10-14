"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw } from "lucide-react";
import { db, saveDocContent, snapshotDoc } from "@/lib/db";
import { htmlToText } from "@/lib/analysis";
import { useUI } from "@/lib/store";
import type { Snapshot } from "@/lib/types";
import { useStudioData } from "@/hooks/useStudioData";
import { Button, Empty } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

export function HistoryPanel() {
  const { doc } = useStudioData();
  const ui = useUI();
  const snaps = useLiveQuery(() => (doc ? db.snapshots.where("docId").equals(doc.id).reverse().sortBy("createdAt") : Promise.resolve([] as Snapshot[])), [doc?.id]) ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  if (!doc) {
    return (
      <div className="p-4">
        <Empty title="No history yet" body="Open a piece. Snapshots are taken before every companion edit, every eight minutes of writing, and whenever you press Ctrl S." />
      </div>
    );
  }

  async function restore(id: string) {
    const s = snaps.find((x) => x.id === id);
    if (!s || !doc) return;
    await snapshotDoc(doc.id, "Before restore");
    await saveDocContent(doc.id, s.html, htmlToText(s.html));
    // Re-mount the editor with the restored content.
    const current = doc.id;
    ui.setDoc(null);
    setTimeout(() => ui.setDoc(current), 0);
    toast("Restored", `Back to ${new Date(s.createdAt).toLocaleString()}.`, "success");
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-medium">History</h2>
          <p className="mt-0.5 text-xs text-ink-3">Snapshots of this piece. The newest sixty are kept.</p>
        </div>
        <Button size="sm" onClick={() => snapshotDoc(doc.id, "Manual snapshot").then(() => toast("Snapshot saved"))}>
          Snapshot now
        </Button>
      </div>

      {snaps.length === 0 && <Empty title="Nothing yet" body="Press Ctrl S to save a snapshot, or keep writing and one will be taken for you." />}

      <ol className="relative space-y-1 border-l border-line pl-3">
        {snaps.map((s) => {
          const open = openId === s.id;
          const delta = s.wordCount - doc.wordCount;
          return (
            <li key={s.id} className="relative">
              <span className="absolute -left-[17px] top-3 h-2 w-2 rounded-full bg-line-2" />
              <button onClick={() => setOpenId(open ? null : s.id)} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">{s.reason}</span>
                <span className="text-[11px] tabular-nums text-ink-3">{s.wordCount.toLocaleString()} w{delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}</span>
                <span className="text-[11px] text-ink-3">{timeAgo(s.createdAt)}</span>
              </button>
              {open && (
                <div className="sf-enter mb-2 ml-2 rounded-[10px] border border-line p-3">
                  <p className="max-h-40 overflow-y-auto whitespace-pre-wrap font-display text-[13px] leading-relaxed text-ink-2">{htmlToText(s.html).slice(0, 1200) || "(empty)"}</p>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" tone="gold" onClick={() => restore(s.id)} icon={<RotateCcw size={13} />}>
                      Restore this version
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}
