"use client";

import { useState } from "react";
import { Compass, GitBranch } from "lucide-react";
import { countWords, createDoc, db, forkDoc } from "@/lib/db";
import { companionJson } from "@/lib/ai/client";
import { useCompanionContext } from "@/hooks/useCompanionContext";
import { useUI } from "@/lib/store";
import { textToHtml } from "../Editor";
import { Button, Empty, Input, Pill, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

interface Fork {
  label: string;
  kind: "twist" | "escalation" | "emotional" | "genre_shift" | "quiet" | "structural";
  premise: string;
  firstLines: string;
  cost: string;
  reward: string;
}
interface CompassResult {
  whereWeAre: string;
  promises: string[];
  nextBeat: string;
  danger: string;
  questionForWriter: string;
}

const KIND_HUE: Record<Fork["kind"], number> = { twist: 330, escalation: 20, emotional: 280, genre_shift: 200, quiet: 170, structural: 60 };

export function ForksPanel() {
  const ui = useUI();
  const { work, doc, docs, craft, bible } = useCompanionContext();
  const [busy, setBusy] = useState<"forks" | "compass" | null>(null);
  const [forks, setForks] = useState<Fork[]>([]);
  const [compass, setCompass] = useState<CompassResult | null>(null);
  const [steer, setSteer] = useState("");
  const [manualLabel, setManualLabel] = useState("");

  const children = doc ? docs.filter((d) => d.parentId === doc.id) : [];
  const parent = doc?.parentId ? docs.find((d) => d.id === doc.parentId) : undefined;

  async function generate() {
    if (!work || !doc) return;
    setBusy("forks");
    try {
      const res = await companionJson<{ forks: Fork[] }>({
        task: "forks",
        craft: craft.id,
        workTitle: work.title,
        logline: work.logline,
        text: doc.text,
        bible,
        instruction: steer.trim() || undefined,
      });
      setForks(res.forks);
    } catch (e) {
      toast("Could not imagine forks", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function orient() {
    if (!work || !doc) return;
    setBusy("compass");
    try {
      const res = await companionJson<CompassResult>({ task: "compass", craft: craft.id, workTitle: work.title, logline: work.logline, text: doc.text, bible });
      setCompass(res);
    } catch (e) {
      toast("Could not orient", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function takeFork(f: Fork) {
    if (!doc) return;
    const forked = await forkDoc(doc.id, f.label);
    const html = forked.html + textToHtml(f.firstLines);
    const text = `${forked.text}\n\n${f.firstLines}`;
    await db.docs.update(forked.id, { html, text, wordCount: countWords(text), goal: f.premise });
    ui.setDoc(forked.id);
    toast("Forked", `“${f.label}” is a new branch. The original is untouched.`, "success");
  }

  async function manualFork() {
    if (!doc) return;
    const label = manualLabel.trim() || `Branch ${children.length + 1}`;
    const forked = await forkDoc(doc.id, label);
    setManualLabel("");
    ui.setDoc(forked.id);
    toast("Forked", `“${label}” is a copy you can take anywhere.`, "success");
  }

  async function blankNext() {
    if (!work || !doc) return;
    const d = await createDoc(work.id, `${craft.unitLabel} ${docs.filter((x) => !x.parentId).length + 1}`);
    ui.setDoc(d.id);
  }

  if (!doc) {
    return (
      <div className="p-4">
        <Empty title="Nothing to fork" body="Open a piece. Forks are alternate versions that stay attached to their parent." />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-display text-lg font-medium">Forks</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Not sure where this goes? Branch it. Each fork is a full copy you can write into; the original stays as it is.
        </p>
      </div>

      {parent && (
        <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
          This is a branch of{" "}
          <button className="font-medium text-ink underline decoration-line-2 underline-offset-2" onClick={() => ui.setDoc(parent.id)}>
            {parent.title}
          </button>
          .
        </p>
      )}

      {children.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-medium text-ink-2">Branches of this {craft.unitLabel.toLowerCase()}</h3>
          <ul className="space-y-1">
            {children.map((c) => (
              <li key={c.id}>
                <button onClick={() => ui.setDoc(c.id)} className="flex w-full items-center gap-2 rounded-[8px] border border-line px-2.5 py-2 text-left text-[13px] hover:border-line-2">
                  <GitBranch size={13} className="text-lilac" />
                  <span className="min-w-0 flex-1 truncate">{c.forkLabel ?? c.title}</span>
                  <span className="text-[10px] text-ink-3">{c.wordCount.toLocaleString()} w</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex gap-1">
          <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="Name a branch (e.g. “she confesses”)" className="h-9 text-xs" />
          <Button size="sm" onClick={manualFork} icon={<GitBranch size={13} />}>
            Fork
          </Button>
        </div>
      </section>

      <section className="space-y-2 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Ask the companion for six futures</h3>
        </div>
        <Input value={steer} onChange={(e) => setSteer(e.target.value)} placeholder="Optional steer: “keep it quiet”, “someone lies”…" className="h-9 text-xs" />
        <div className="flex gap-2">
          <Button size="sm" tone="aurora" onClick={generate} disabled={busy !== null || doc.wordCount < 30} icon={busy === "forks" ? <Spinner /> : undefined}>
            Imagine forks
          </Button>
          <Button size="sm" onClick={orient} disabled={busy !== null || doc.wordCount < 30} icon={busy === "compass" ? <Spinner /> : <Compass size={13} />}>
            Where am I?
          </Button>
        </div>
      </section>

      {compass && (
        <section className="sf-enter rounded-[12px] border border-line p-3 text-xs leading-relaxed">
          <p className="text-ink">{compass.whereWeAre}</p>
          {compass.promises.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] font-medium text-ink-2">Promises made to the reader</div>
              <ul className="mt-1 list-disc pl-4 text-ink-2">
                {compass.promises.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2"><span className="font-medium text-aurora">Next beat.</span> {compass.nextBeat}</p>
          <p className="mt-1"><span className="font-medium text-ember">Danger.</span> {compass.danger}</p>
          <p className="mt-2 font-display text-[14px] italic text-ink">{compass.questionForWriter}</p>
        </section>
      )}

      {forks.length > 0 && (
        <ul className="space-y-2">
          {forks.map((f, i) => (
            <li key={i} className="sf-enter rounded-[12px] border border-line p-3" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[15px] font-medium">{f.label}</span>
                <Pill hue={KIND_HUE[f.kind]}>{f.kind.replace("_", " ")}</Pill>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{f.premise}</p>
              <p className="mt-2 border-l-2 border-line pl-2 font-display text-[13px] italic leading-relaxed text-ink">{f.firstLines}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-ember">Costs.</span> <span className="text-ink-2">{f.cost}</span></div>
                <div><span className="text-aurora">Rewards.</span> <span className="text-ink-2">{f.reward}</span></div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" tone="gold" onClick={() => takeFork(f)} icon={<GitBranch size={13} />}>
                  Fork this way
                </Button>
                <Button size="sm" tone="ghost" onClick={() => { ui.queueInsert(f.firstLines, "insert"); toast("Inserted", "The branch's opening lines were added at the end."); }}>
                  Just insert the lines
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="border-t border-line pt-4">
        <Button size="sm" tone="ghost" onClick={blankNext}>
          Start the next {craft.unitLabel.toLowerCase()} instead
        </Button>
      </section>
    </div>
  );
}
