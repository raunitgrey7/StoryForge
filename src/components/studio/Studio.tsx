"use client";

import { useEffect, useState } from "react";
import { Library, PenLine, Sparkles, Wand2 } from "lucide-react";
import { db, getSetting, setSetting, snapshotDoc } from "@/lib/db";
import { useUI } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { useStudioData } from "@/hooks/useStudioData";
import { useIsMobile } from "@/hooks/useIsMobile";
import { startCloud } from "@/lib/cloud/sync";
import type { Work } from "@/lib/types";
import { Rail } from "./Rail";
import { TopBar } from "./TopBar";
import { Editor } from "./Editor";
import { Dock } from "./Dock";
import { CommandPalette } from "./CommandPalette";
import { NewWorkDialog } from "./NewWorkDialog";
import { WorkSettingsDialog } from "./WorkSettingsDialog";
import { Welcome } from "./Welcome";
import { toast } from "@/components/ui/Toast";

export function Studio() {
  const ui = useUI(
    useShallow((s) => ({
      workId: s.workId,
      docId: s.docId,
      railOpen: s.railOpen,
      dockOpen: s.dockOpen,
      dockTab: s.dockTab,
      dockWide: s.dockWide,
      focusMode: s.focusMode,
      paletteOpen: s.paletteOpen,
      toggleRail: s.toggleRail,
      toggleDock: s.toggleDock,
      toggleFocus: s.toggleFocus,
      toggleDockWide: s.toggleDockWide,
      setPalette: s.setPalette,
      setDockTab: s.setDockTab,
    })),
  );
  const mobile = useIsMobile();
  const { works, work, docs, doc, loading } = useStudioData();
  const [ready, setReady] = useState(false);
  const [newWorkOpen, setNewWorkOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState<Work | null>(null);

  // Restore where the writer left off, or honour ?work= / ?doc= from the Atlas.
  useEffect(() => {
    startCloud();
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const qDoc = params.get("doc");
      const qWork = params.get("work");
      const theme = (localStorage.getItem("sf:theme") as "dark" | "light") || "dark";
      useUI.setState({ theme });
      if (qDoc) {
        const d = await db.docs.get(qDoc);
        if (d) {
          useUI.setState({ workId: d.workId, docId: d.id });
          setReady(true);
          return;
        }
      }
      if (qWork) {
        const w = await db.works.get(qWork);
        if (w) {
          const first = (await db.docs.where("workId").equals(w.id).sortBy("order"))[0];
          useUI.setState({ workId: w.id, docId: first?.id ?? null });
          setReady(true);
          return;
        }
      }
      const last = await getSetting<{ workId: string | null; docId: string | null }>("sf:last", { workId: null, docId: null });
      if (last.workId && (await db.works.get(last.workId))) {
        const d = last.docId ? await db.docs.get(last.docId) : undefined;
        useUI.setState({ workId: last.workId, docId: d?.id ?? null });
      }
      setReady(true);
    })();
  }, []);

  // On phones the rail and dock start closed; on desktop they start open.
  useEffect(() => {
    useUI.setState({ railOpen: !mobile, dockOpen: !mobile });
  }, [mobile]);

  // Remember position.
  useEffect(() => {
    if (!ready) return;
    setSetting("sf:last", { workId: ui.workId, docId: ui.docId });
  }, [ready, ui.workId, ui.docId]);

  // If the selected doc vanished (deleted), fall back to the first doc of the work.
  useEffect(() => {
    if (!ready || !ui.workId) return;
    if (ui.docId && doc === undefined && docs.length && !docs.some((d) => d.id === ui.docId)) {
      useUI.setState({ docId: docs[0].id });
    }
    if (!ui.docId && docs.length) useUI.setState({ docId: docs[0].id });
  }, [ready, ui.workId, ui.docId, doc, docs]);

  // Global hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setPalette(!ui.paletteOpen);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (ui.docId) {
          snapshotDoc(ui.docId, "Manual snapshot").then(() => toast("Snapshot saved", "Find it under History."));
        }
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        ui.toggleFocus();
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        ui.toggleDock();
      } else if (e.key === "Escape" && ui.focusMode) {
        ui.toggleFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui]);

  if (!ready || loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-bg text-ink-3">
        <span className="font-display text-lg">Opening the studio…</span>
      </div>
    );
  }

  const page = work && doc ? <Editor key={doc.id} doc={doc} /> : <Welcome hasWorks={works.length > 0} onNewWork={() => setNewWorkOpen(true)} />;

  /* ---------------- Mobile: one column, drawers, bottom bar ---------------- */
  if (mobile) {
    const showRail = ui.railOpen;
    const showDock = ui.dockOpen;
    return (
      <div className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-bg text-ink ${ui.focusMode ? "sf-focus" : ""}`}>
        <TopBar />
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 flex flex-col">{page}</div>

          {showRail && (
            <div className="absolute inset-0 z-30 flex">
              <div className="sf-enter h-full w-[min(88vw,320px)] border-r border-line bg-surface shadow-2xl">
                <Rail works={works} docs={docs} onNewWork={() => setNewWorkOpen(true)} onSettings={setSettingsFor} onPick={() => ui.toggleRail(false)} />
              </div>
              <button className="flex-1 bg-bg-deep/50" aria-label="Close works" onClick={() => ui.toggleRail(false)} />
            </div>
          )}

          {showDock && (
            <div className="sf-enter absolute inset-0 z-30 bg-surface">
              <Dock onClose={() => ui.toggleDock(false)} />
            </div>
          )}
        </div>

        {!ui.focusMode && (
          <nav className="grid h-14 shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
            <TabButton icon={<Library size={18} />} label="Works" active={showRail} onClick={() => { ui.toggleDock(false); ui.toggleRail(!showRail); }} />
            <TabButton icon={<PenLine size={18} />} label="Write" active={!showRail && !showDock} onClick={() => { ui.toggleDock(false); ui.toggleRail(false); }} />
            <TabButton
              icon={<Sparkles size={18} />}
              label="Companion"
              active={showDock && ui.dockTab !== "muse"}
              onClick={() => {
                ui.toggleRail(false);
                if (showDock && ui.dockTab !== "muse") ui.toggleDock(false);
                else ui.setDockTab(ui.dockTab === "muse" ? "companion" : ui.dockTab);
              }}
            />
            <TabButton
              icon={<Wand2 size={18} />}
              label="Muse"
              active={showDock && ui.dockTab === "muse"}
              onClick={() => {
                ui.toggleRail(false);
                if (showDock && ui.dockTab === "muse") ui.toggleDock(false);
                else ui.setDockTab("muse");
              }}
            />
          </nav>
        )}

        <CommandPalette onNewWork={() => setNewWorkOpen(true)} />
        <NewWorkDialog open={newWorkOpen} onClose={() => setNewWorkOpen(false)} />
        <WorkSettingsDialog work={settingsFor} onClose={() => setSettingsFor(null)} />
      </div>
    );
  }

  /* ---------------- Desktop: three columns ---------------- */
  const railW = ui.railOpen ? 272 : 0;
  const wide = ui.dockOpen && ui.dockWide;
  const columns = wide ? `${railW}px 0px minmax(0,1fr)` : `${railW}px minmax(0,1fr) ${ui.dockOpen ? 400 : 0}px`;

  return (
    <div className={`h-[100dvh] w-screen overflow-hidden bg-bg text-ink ${ui.focusMode ? "sf-focus" : ""}`}>
      <div
        className="grid h-full min-h-0 transition-[grid-template-columns] duration-300 ease-out"
        style={{ gridTemplateColumns: columns, gridTemplateRows: "minmax(0, 1fr)" }}
      >
        <aside className={`h-full min-h-0 overflow-hidden border-r border-line bg-surface ${ui.railOpen ? "" : "border-r-0"}`}>
          <Rail works={works} docs={docs} onNewWork={() => setNewWorkOpen(true)} onSettings={setSettingsFor} />
        </aside>

        <section className={`flex h-full min-h-0 min-w-0 flex-col ${wide ? "overflow-hidden" : ""}`}>
          <TopBar />
          {page}
        </section>

        <aside className={`h-full min-h-0 overflow-hidden border-l border-line bg-surface ${ui.dockOpen ? "" : "border-l-0"}`}>
          <Dock wide={wide} onToggleWide={() => ui.toggleDockWide()} />
        </aside>
      </div>

      <CommandPalette onNewWork={() => setNewWorkOpen(true)} />
      <NewWorkDialog open={newWorkOpen} onClose={() => setNewWorkOpen(false)} />
      <WorkSettingsDialog work={settingsFor} onClose={() => setSettingsFor(null)} />
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${active ? "text-gold" : "text-ink-3"}`}>
      {icon}
      {label}
    </button>
  );
}
