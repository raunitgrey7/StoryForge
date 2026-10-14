"use client";

import { Activity, BookOpen, GitBranch, History, Maximize2, Minimize2, Sparkles, Timer, Wand2, X } from "lucide-react";
import { useUI, type DockTab } from "@/lib/store";
import { CompanionPanel } from "./panels/CompanionPanel";
import { PulsePanel } from "./panels/PulsePanel";
import { BiblePanel } from "./panels/BiblePanel";
import { ForksPanel } from "./panels/ForksPanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import { SprintPanel } from "./panels/SprintPanel";
import { MusePanel } from "./panels/MusePanel";

const TABS: { id: DockTab; label: string; icon: React.ReactNode; tip: string }[] = [
  { id: "companion", label: "Companion", icon: <Sparkles size={15} />, tip: "Write with the companion: continue, rewrite, tighten, critique, all in your voice." },
  { id: "muse", label: "Muse", icon: <Wand2 size={15} />, tip: "Recommendations from your tastes: a character, a plot, a story, the next chapter, a whole book." },
  { id: "pulse", label: "Pulse", icon: <Activity size={15} />, tip: "Instant, local reading of this piece: tension, rhythm, readability, habits." },
  { id: "bible", label: "Bible", icon: <BookOpen size={15} />, tip: "Who and what must stay consistent, and a continuity check against it." },
  { id: "forks", label: "Forks", icon: <GitBranch size={15} />, tip: "Branch this piece and try another direction without losing the original." },
  { id: "history", label: "History", icon: <History size={15} />, tip: "Snapshots of this piece you can restore at any time." },
  { id: "sprint", label: "Sprint", icon: <Timer size={15} />, tip: "A timer and a word goal. Nobody watching." },
];

export function Dock({ onClose, wide, onToggleWide }: { onClose?: () => void; wide?: boolean; onToggleWide?: () => void }) {
  const tab = useUI((s) => s.dockTab);
  const setTab = useUI((s) => s.setDockTab);
  return (
    <div className={`flex h-full min-h-0 w-full flex-col ${wide ? "" : "lg:w-[400px]"}`}>
      <nav className="flex shrink-0 items-center gap-0.5 border-b border-line px-2 pt-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-tip={t.tip}
            data-tip-side="bottom"
            data-tip-align={i < TABS.length / 2 ? "start" : "end"}
            className={`relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-t-[8px] px-2.5 text-xs font-medium transition-colors ${tab === t.id ? "flex-[2] text-ink" : "flex-1 text-ink-3 hover:text-ink-2"}`}
          >
            {t.icon}
            {tab === t.id && <span>{t.label}</span>}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
          </button>
        ))}
        {onToggleWide && (
          <button
            onClick={onToggleWide}
            data-tip={wide ? "Back to the page beside the dock." : "Give the dock the whole width. Good for long recommendations."}
            data-tip-side="bottom"
            data-tip-align="end"
            className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-ink-3 hover:text-ink"
            aria-label={wide ? "Shrink the dock" : "Widen the dock"}
          >
            {wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-ink-3 hover:text-ink" aria-label="Back to the page">
            <X size={16} />
          </button>
        )}
      </nav>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${wide ? "[&>*]:mx-auto [&>*]:max-w-3xl" : ""}`}>
        {tab === "companion" && <CompanionPanel />}
        {tab === "muse" && <MusePanel />}
        {tab === "pulse" && <PulsePanel />}
        {tab === "bible" && <BiblePanel />}
        {tab === "forks" && <ForksPanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "sprint" && <SprintPanel />}
      </div>
    </div>
  );
}
