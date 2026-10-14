"use client";

import { useState } from "react";
import Link from "next/link";
import { seedDemo } from "@/lib/demo";
import { db } from "@/lib/db";
import { useUI } from "@/lib/store";
import { Button, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

export function Welcome({ hasWorks, onNewWork }: { hasWorks: boolean; onNewWork: () => void }) {
  const [seeding, setSeeding] = useState(false);
  const ui = useUI();

  async function loadDemo() {
    setSeeding(true);
    try {
      await seedDemo();
      const first = (await db.works.orderBy("updatedAt").reverse().toArray()).find((w) => w.craft === "novel");
      if (first) {
        const d = (await db.docs.where("workId").equals(first.id).sortBy("order"))[0];
        ui.setWork(first.id);
        ui.setDoc(d?.id ?? null);
      }
      toast("Demo universe loaded", "A novel, a poetry collection and a blog. Open the atlas to see them.", "success");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-page px-6 py-12 text-[#221c3d]">
      <div className="max-w-xl">
        <h1 className="font-display text-4xl font-medium leading-tight" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 60, "WONK" 1' }}>
          {hasWorks ? "Pick something from the rail, or begin again." : "A blank page, and a companion that waits."}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#4b4570]">
          Start a novel, a poem, a post, a screenplay, a song, a journal entry. The studio reshapes itself around the craft. Nothing leaves your device unless you ask the companion for help with a passage.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button tone="gold" size="lg" onClick={onNewWork}>
            Start a new work
          </Button>
          <Link href="/commission" className="inline-flex h-12 items-center justify-center rounded-[10px] border border-[#c9971c] px-6 text-[15px] font-medium text-[#2a1f02] hover:bg-[#c9971c]/10">
            Commission a story
          </Link>
          {!hasWorks && (
            <Button size="lg" tone="paper" onClick={loadDemo} disabled={seeding} icon={seeding ? <Spinner /> : undefined}>
              Load the demo universe
            </Button>
          )}
        </div>
        <dl className="mt-12 grid gap-4 text-sm text-[#4b4570] sm:grid-cols-3">
          <div>
            <dt className="font-medium text-[#221c3d]">Ctrl K</dt>
            <dd>Jump to any chapter or action</dd>
          </div>
          <div>
            <dt className="font-medium text-[#221c3d]">Ctrl Enter</dt>
            <dd>Ask the companion to continue</dd>
          </div>
          <div>
            <dt className="font-medium text-[#221c3d]">Ctrl Shift F</dt>
            <dd>Focus mode</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
