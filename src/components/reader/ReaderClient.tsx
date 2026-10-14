"use client";

import dynamic from "next/dynamic";

const Reader = dynamic(() => import("./Reader").then((m) => m.Reader), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-page text-[#8a84ad]">
      <span className="font-display text-lg">Opening the book…</span>
    </div>
  ),
});

export function ReaderClient({ workId }: { workId: string }) {
  return <Reader workId={workId} />;
}
