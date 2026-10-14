"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CRAFT_LIST } from "@/lib/crafts";
import { createDoc, createWork, countWords } from "@/lib/db";
import { upsertEntities } from "@/lib/entities";
import { companionJson } from "@/lib/ai/client";
import { useUI } from "@/lib/store";
import { RATING_META, type CraftId, type Rating } from "@/lib/types";
import { useProfile } from "@/hooks/useProfile";
import { AdultGate } from "./AdultGate";
import { Button, Field, Input, Spinner, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

interface SeedResult {
  title: string;
  logline: string;
  units: { title: string; goal: string; opening: string }[];
  cast: { kind: "character" | "place" | "object" | "theme"; name: string; description: string; traits: string[] }[];
}

export function NewWorkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Dialog onClose={onClose} />;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const ui = useUI();
  const [craft, setCraft] = useState<CraftId>("novel");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState<"blank" | "seed" | null>(null);
  const [rating, setRating] = useState<Rating>("everyone");
  const [fandom, setFandom] = useState("");
  const [gate, setGate] = useState(false);
  const profile = useProfile();
  const adultRating = rating === "mature" || rating === "explicit";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = CRAFT_LIST.find((c) => c.id === craft)!;

  const meta = () => ({ rating, heat: adultRating ? (rating === "explicit" ? 4 : 2) : 0, fandom: fandom.trim() || undefined });

  async function startBlank() {
    if (adultRating && !profile.adultVerified) {
      setGate(true);
      return;
    }
    setBusy("blank");
    try {
      const w = await createWork({ title: title.trim() || `Untitled ${selected.label.toLowerCase()}`, craft, logline: idea.trim(), ...meta() });
      const d = await createDoc(w.id, `${selected.unitLabel} 1`);
      ui.setWork(w.id);
      ui.setDoc(d.id);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  async function startSeeded() {
    if (!idea.trim()) {
      toast("Tell the companion the idea first", "A sentence is enough.");
      return;
    }
    if (adultRating && !profile.adultVerified) {
      setGate(true);
      return;
    }
    setBusy("seed");
    try {
      const seed = await companionJson<SeedResult>({ task: "seed", craft, workTitle: title || "Untitled", text: idea, instruction: idea, ...meta(), adult: profile.adultVerified, tastes: profile.tastes });
      const w = await createWork({ title: title.trim() || seed.title, craft, logline: seed.logline, ...meta() });
      let firstId: string | null = null;
      for (const [i, u] of seed.units.entries()) {
        const html = `<p>${escape(u.opening)}</p>`;
        const d = await createDoc(w.id, u.title, { html, text: u.opening, wordCount: countWords(u.opening), order: i, goal: u.goal });
        if (!firstId) firstId = d.id;
      }
      await upsertEntities(w.id, seed.cast);
      ui.setWork(w.id);
      ui.setDoc(firstId);
      toast("Seeded", `${seed.units.length} ${selected.unitPlural.toLowerCase()} and ${seed.cast.length} bible entries. All of it is yours to rewrite.`, "success");
      onClose();
    } catch (e) {
      toast("Could not seed", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-deep/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <AdultGate open={gate} onClose={() => setGate(false)} />
      <div className="sf-enter max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[18px] border border-line bg-surface p-5 shadow-2xl sm:rounded-[16px] sm:p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium">Start a new work</h2>
            <p className="mt-1 text-sm text-ink-2">Pick the craft. The studio and the companion will shape themselves around it.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CRAFT_LIST.map((c) => (
            <button
              key={c.id}
              onClick={() => setCraft(c.id)}
              className={`rounded-[10px] border px-3 py-2.5 text-left text-sm transition-colors ${
                craft === c.id ? "border-gold bg-gold/10 text-ink" : "border-line text-ink-2 hover:border-line-2"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">{selected.tagline}</p>

        <div className="mt-5 grid gap-4">
          <Field label="Title (optional)">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Untitled ${selected.label.toLowerCase()}`} autoFocus />
          </Field>
          <Field label="The idea, in a sentence or two" hint="Used as the logline. If you ask the companion to seed the work, it will propose an opening structure and cast from this.">
            <Textarea rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="A mapmaker who cannot lie is hired to chart a city that changes shape every night." />
          </Field>
          {(craft === "fanfic" || fandom) && (
            <Field label="Fandom">
              <Input value={fandom} onChange={(e) => setFandom(e.target.value)} placeholder="Star Wars, Bridgerton, Genshin Impact, Harry Potter…" />
            </Field>
          )}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Rating</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(RATING_META) as Rating[]).map((r) => (
                <button key={r} type="button" onClick={() => setRating(r)} data-tip={RATING_META[r].blurb} className={`rounded-full border px-3 py-1 text-xs ${rating === r ? "border-gold bg-gold/10 text-ink" : "border-line text-ink-2 hover:border-line-2"}`}>
                  {RATING_META[r].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-3">{RATING_META[rating].blurb} You can change this any time in the work&apos;s settings.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={startBlank} disabled={busy !== null} icon={busy === "blank" ? <Spinner /> : undefined}>
            Blank page
          </Button>
          <Button tone="gold" onClick={startSeeded} disabled={busy !== null} icon={busy === "seed" ? <Spinner /> : undefined}>
            Seed it with the companion
          </Button>
        </div>
      </div>
    </div>
  );
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
