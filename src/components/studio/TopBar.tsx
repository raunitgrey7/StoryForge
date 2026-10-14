"use client";

import { useState } from "react";
import { Command, Focus, PanelLeft, PanelRight } from "lucide-react";
import { db } from "@/lib/db";
import { useUI } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { useStudioData } from "@/hooks/useStudioData";
import { IconButton } from "@/components/ui/primitives";

export function TopBar() {
  const ui = useUI(useShallow((s) => ({ railOpen: s.railOpen, dockOpen: s.dockOpen, focusMode: s.focusMode, toggleRail: s.toggleRail, toggleDock: s.toggleDock, toggleFocus: s.toggleFocus, setPalette: s.setPalette })));
  const { work, doc, craft } = useStudioData();
  const status = doc?.status ?? "draft";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-2 backdrop-blur">
      <IconButton label={ui.railOpen ? "Hide the list of works and chapters" : "Show the list of works and chapters"} onClick={() => ui.toggleRail()} active={ui.railOpen}>
        <PanelLeft size={17} />
      </IconButton>

      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        {work && (
          <span className="hidden max-w-[180px] truncate text-xs text-ink-3 sm:inline" title={work.title}>
            {work.title}
          </span>
        )}
        {work && doc && <span className="text-ink-3">/</span>}
        {doc ? (
          <TitleInput key={`${doc.id}:${doc.title}`} docId={doc.id} initial={doc.title} label={`${craft.unitLabel} title`} />
        ) : (
          <span className="text-sm text-ink-3">Nothing open</span>
        )}
      </div>

      {doc && (
        <span data-tip="Draft, revising or done. Shown in the rail, the atlas and the reader." data-tip-side="bottom">
        <select
          value={status}
          onChange={(e) => db.docs.update(doc.id, { status: e.target.value as typeof status })}
          className="h-7 rounded-md border border-line bg-surface-2 px-1.5 text-xs text-ink-2"
          aria-label="Status"
        >
          <option value="draft">Draft</option>
          <option value="revising">Revising</option>
          <option value="done">Done</option>
        </select>
        </span>
      )}

      <button
        onClick={() => ui.setPalette(true)}
        data-tip="Jump to any chapter, poem, panel or action by typing its name."
        data-tip-side="bottom"
        className="hidden h-8 items-center gap-2 rounded-[10px] border border-line px-2.5 text-xs text-ink-3 hover:border-line-2 hover:text-ink md:inline-flex"
      >
        <Command size={13} /> Jump anywhere <kbd className="sf-kbd">Ctrl K</kbd>
      </button>

      <IconButton label="Focus mode: dims everything but the paragraph you are in. Ctrl Shift F, Esc to leave." onClick={() => ui.toggleFocus()} active={ui.focusMode}>
        <Focus size={17} />
      </IconButton>
      <IconButton label={ui.dockOpen ? "Hide the companion dock. Ctrl \\" : "Show the companion dock. Ctrl \\"} onClick={() => ui.toggleDock()} active={ui.dockOpen}>
        <PanelRight size={17} />
      </IconButton>
    </header>
  );
}

function TitleInput({ docId, initial, label }: { docId: string; initial: string; label: string }) {
  const [title, setTitle] = useState(initial);
  function commit() {
    const t = title.trim() || "Untitled";
    if (t !== initial) db.docs.update(docId, { title: t, updatedAt: Date.now() });
    setTitle(t);
  }
  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-ink outline-none"
      aria-label={label}
    />
  );
}
