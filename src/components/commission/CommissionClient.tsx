"use client";

import dynamic from "next/dynamic";

const Commission = dynamic(() => import("./Commission").then((m) => m.Commission), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] items-center justify-center bg-bg text-ink-3">
      <span className="font-display text-lg">Opening the commission desk…</span>
    </div>
  ),
});

export function CommissionClient() {
  return <Commission />;
}
