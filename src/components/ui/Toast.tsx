"use client";

import { create } from "zustand";

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: "info" | "success" | "error";
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let counter = 1;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (t) => {
    const id = counter++;
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), t.tone === "error" ? 7000 : 3600);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export function toast(title: string, body?: string, tone: ToastItem["tone"] = "info") {
  useToasts.getState().push({ title, body, tone });
}

export function ToastHost() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="sf-enter pointer-events-auto rounded-[12px] border px-4 py-3 text-left shadow-lg backdrop-blur"
          style={{
            background: "color-mix(in oklab, var(--surface) 92%, transparent)",
            borderColor: t.tone === "error" ? "var(--ember)" : t.tone === "success" ? "var(--aurora)" : "var(--line-2)",
          }}
        >
          <div className="text-sm font-semibold text-ink">{t.title}</div>
          {t.body && <div className="mt-0.5 text-xs leading-relaxed text-ink-2">{t.body}</div>}
        </button>
      ))}
    </div>
  );
}
