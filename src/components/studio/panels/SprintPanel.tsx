"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, uid } from "@/lib/db";
import { useStudioData } from "@/hooks/useStudioData";
import type { Sprint } from "@/lib/types";
import { Button, Empty, Input } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

const NO_SPRINTS: Sprint[] = [];

export function SprintPanel() {
  const { work, doc } = useStudioData();
  const [minutes, setMinutes] = useState(15);
  const [goalWords, setGoalWords] = useState(300);
  const [active, setActive] = useState<Sprint | null>(null);
  const [now, setNow] = useState(Date.now());
  const tick = useRef<number | null>(null);

  const history = useLiveQuery(() => (work ? db.sprints.where("workId").equals(work.id).reverse().sortBy("startedAt") : Promise.resolve(NO_SPRINTS)), [work?.id]) ?? NO_SPRINTS;

  useEffect(() => {
    if (!active) return;
    tick.current = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [active]);

  const elapsed = active ? now - active.startedAt : 0;
  const remaining = active ? Math.max(0, active.minutes * 60_000 - elapsed) : 0;
  const written = active && doc ? Math.max(0, doc.wordCount - active.wordsStart) : 0;

  useEffect(() => {
    if (active && remaining === 0) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, active]);

  async function start() {
    if (!work || !doc) return;
    const s: Sprint = { id: uid("sp"), workId: work.id, docId: doc.id, startedAt: Date.now(), minutes, wordsStart: doc.wordCount, goalWords };
    await db.sprints.add(s);
    setActive(s);
    setNow(Date.now());
  }

  async function finish(timeUp = false) {
    if (!active || !doc) return;
    const wordsEnd = doc.wordCount;
    await db.sprints.update(active.id, { endedAt: Date.now(), wordsEnd });
    const got = wordsEnd - active.wordsStart;
    toast(timeUp ? "Time" : "Sprint ended", `${got} words in ${Math.round((Date.now() - active.startedAt) / 60_000)} minutes${got >= active.goalWords ? ". Goal met." : "."}`, got >= active.goalWords ? "success" : "info");
    setActive(null);
  }

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return history.filter((s) => s.startedAt >= start.getTime() && s.wordsEnd !== undefined).reduce((n, s) => n + Math.max(0, (s.wordsEnd ?? 0) - s.wordsStart), 0);
  }, [history]);

  const streak = useMemo(() => {
    const days = new Set(history.filter((s) => s.wordsEnd !== undefined).map((s) => new Date(s.startedAt).toDateString()));
    let n = 0;
    const d = new Date();
    for (;;) {
      if (!days.has(d.toDateString())) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [history]);

  if (!doc) {
    return (
      <div className="p-4">
        <Empty title="Open a piece to sprint" body="A sprint is a timer and a word goal. The count comes from the page you are on." />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-display text-lg font-medium">Sprint</h2>
        <p className="mt-0.5 text-xs text-ink-3">A timer, a goal, and no one watching.</p>
      </div>

      {active ? (
        <div className="sf-enter rounded-[14px] border border-gold/50 bg-gold/5 p-4 text-center">
          <div className="font-display text-5xl tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>
            {fmt(remaining)}
          </div>
          <div className="mt-2 text-sm text-ink-2">
            <span className="font-medium text-ink">{written}</span> of {active.goalWords} words
          </div>
          <div className="mx-auto mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${Math.min(100, (written / active.goalWords) * 100)}%` }} />
          </div>
          <Button size="sm" tone="ghost" className="mt-3" onClick={() => finish(false)}>
            End early
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-[14px] border border-line p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-ink-2">
              Minutes
              <Input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-ink-2">
              Word goal
              <Input type="number" min={10} step={50} value={goalWords} onChange={(e) => setGoalWords(Math.max(10, Number(e.target.value) || 10))} className="mt-1 h-9" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              [10, 200],
              [15, 300],
              [25, 500],
              [45, 900],
            ].map(([m, w]) => (
              <button key={m} onClick={() => { setMinutes(m); setGoalWords(w); }} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 hover:border-line-2">
                {m} min · {w} words
              </button>
            ))}
          </div>
          <Button tone="gold" onClick={start} className="w-full">
            Start the sprint
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] bg-surface-2 px-3 py-2">
          <div className="font-display text-xl">{today.toLocaleString()}</div>
          <div className="text-[11px] text-ink-3">words in sprints today</div>
        </div>
        <div className="rounded-[10px] bg-surface-2 px-3 py-2">
          <div className="font-display text-xl">{streak}</div>
          <div className="text-[11px] text-ink-3">day streak</div>
        </div>
      </div>

      {history.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-medium text-ink-2">Recent sprints</h3>
          <ul className="space-y-1 text-xs">
            {history.slice(0, 12).map((s) => {
              const got = s.wordsEnd !== undefined ? s.wordsEnd - s.wordsStart : null;
              return (
                <li key={s.id} className="flex items-center justify-between rounded-[8px] px-2 py-1.5 hover:bg-surface-2">
                  <span className="text-ink-2">{new Date(s.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className={`tabular-nums ${got !== null && got >= s.goalWords ? "text-aurora" : "text-ink"}`}>{got === null ? "…" : `${got} / ${s.goalWords}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
