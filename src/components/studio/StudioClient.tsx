"use client";

import dynamic from "next/dynamic";

// The studio talks to IndexedDB and the editor, so it only renders on the client.
const Studio = dynamic(() => import("./Studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-bg text-ink-3">
      <span className="font-display text-lg">Opening the studio…</span>
    </div>
  ),
});

export function StudioClient() {
  return <Studio />;
}
