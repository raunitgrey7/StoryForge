"use client";

import dynamic from "next/dynamic";

const Atlas = dynamic(() => import("./Atlas").then((m) => m.Atlas), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[#0c0a1f] text-[#7f78ab]">
      <span className="font-display text-lg">Charting the sky…</span>
    </div>
  ),
});

export function AtlasClient() {
  return <Atlas />;
}
