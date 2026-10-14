"use client";

import dynamic from "next/dynamic";

const Constellation = dynamic(() => import("@/components/three/Constellation"), { ssr: false });

export function LandingSky() {
  return (
    <>
      <Constellation className="pointer-events-none absolute inset-0 z-0 opacity-90" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(60%_50%_at_30%_20%,rgba(18,15,42,0)_0%,rgba(18,15,42,0.55)_70%,#120f2a_100%)]" />
    </>
  );
}
