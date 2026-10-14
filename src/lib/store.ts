"use client";

import { create } from "zustand";

export type DockTab = "companion" | "muse" | "pulse" | "bible" | "forks" | "history" | "sprint";

interface UIState {
  workId: string | null;
  docId: string | null;
  dockTab: DockTab;
  dockOpen: boolean;
  /** Desktop: the dock takes the whole width, hiding the page (for long recommendations). */
  dockWide: boolean;
  railOpen: boolean;
  focusMode: boolean;
  paletteOpen: boolean;
  /** Current selection in the editor, mirrored so panels can act on it. */
  selection: string;
  /** Pending text the companion wants to insert into the editor. */
  insertQueue: { text: string; mode: "insert" | "replace" } | null;
  theme: "dark" | "light";
  setWork: (id: string | null) => void;
  setDoc: (id: string | null) => void;
  setDockTab: (t: DockTab) => void;
  toggleDock: (open?: boolean) => void;
  toggleDockWide: (wide?: boolean) => void;
  toggleRail: (open?: boolean) => void;
  toggleFocus: () => void;
  setPalette: (open: boolean) => void;
  setSelection: (s: string) => void;
  queueInsert: (text: string, mode: "insert" | "replace") => void;
  clearInsert: () => void;
  setTheme: (t: "dark" | "light") => void;
}

export const useUI = create<UIState>((set) => ({
  workId: null,
  docId: null,
  dockTab: "companion",
  dockOpen: true,
  dockWide: false,
  railOpen: true,
  focusMode: false,
  paletteOpen: false,
  selection: "",
  insertQueue: null,
  theme: "dark",
  setWork: (workId) => set({ workId }),
  setDoc: (docId) => set({ docId }),
  setDockTab: (dockTab) => set({ dockTab, dockOpen: true }),
  toggleDock: (open) => set((s) => ({ dockOpen: open ?? !s.dockOpen, dockWide: (open ?? !s.dockOpen) ? s.dockWide : false })),
  toggleDockWide: (wide) => set((s) => ({ dockWide: wide ?? !s.dockWide, dockOpen: true })),
  toggleRail: (open) => set((s) => ({ railOpen: open ?? !s.railOpen })),
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode, railOpen: s.focusMode, dockOpen: s.focusMode })),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setSelection: (selection) => set({ selection }),
  queueInsert: (text, mode) => set({ insertQueue: { text, mode } }),
  clearInsert: () => set({ insertQueue: null }),
  setTheme: (theme) => {
    try {
      localStorage.setItem("sf:theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
    set({ theme });
  },
}));
