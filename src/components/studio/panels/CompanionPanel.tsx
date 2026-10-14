"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Copy, Replace, Send, Square } from "lucide-react";
import { useCompanionStream } from "@/lib/ai/client";
import { useCompanionContext } from "@/hooks/useCompanionContext";
import { useUI } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { AiTask } from "@/lib/types";
import { describeVoice } from "@/lib/voice";
import { Button, Segmented, Spinner, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";
import { AdultGate } from "../AdultGate";
import { RATING_META } from "@/lib/types";

type Intensity = "gentle" | "balanced" | "wild";
type Length = "short" | "medium" | "long";

export function CompanionPanel() {
  const ui = useUI(useShallow((s) => ({ selection: s.selection, queueInsert: s.queueInsert })));
  const ctx = useCompanionContext();
  const stream = useCompanionStream();
  const [intensity, setIntensity] = useState<Intensity>("balanced");
  const [length, setLength] = useState<Length>("medium");
  const [note, setNote] = useState("");
  const [lastTask, setLastTask] = useState<AiTask | null>(null);
  const [lastWasSelection, setLastWasSelection] = useState(false);
  const [gate, setGate] = useState(false);
  const outRef = useRef<HTMLDivElement>(null);

  const tools = ctx.craft.tools;
  const selection = ui.selection.trim();

  const run = useCallback(
    async (task: AiTask, instruction?: string) => {
      if (!ctx.doc) {
        toast("Open something first", "The companion needs a page to read.");
        return;
      }
      if (ctx.needsAdultGate) {
        setGate(true);
        return;
      }
      const tool = tools.find((t) => t.task === task);
      const needsSel = tool?.needsSelection;
      if (needsSel && !selection) {
        toast("Select a passage first", `“${tool?.label}” works on the text you highlight.`);
        return;
      }
      setLastTask(task);
      setLastWasSelection(Boolean(selection));
      requestAnimationFrame(() => outRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      try {
        await stream.run(
          ctx.base({
            task,
            selection: selection || undefined,
            instruction: instruction ?? (note.trim() || undefined),
            intensity,
            length,
          }),
        );
      } catch (e) {
        toast("The companion could not answer", (e as Error).message, "error");
      }
    },
    [ctx, tools, selection, note, intensity, length, stream],
  );

  // Editor shortcuts (Ctrl+Enter, bubble toolbar) arrive as window events.
  useEffect(() => {
    const onEvt = (e: Event) => {
      const task = (e as CustomEvent<{ task: AiTask }>).detail?.task;
      if (task) run(task);
    };
    window.addEventListener("sf:companion", onEvt);
    return () => window.removeEventListener("sf:companion", onEvt);
  }, [run]);

  useEffect(() => {
    if (!stream.busy || !outRef.current) return;
    const scroller = outRef.current.closest<HTMLElement>(".overflow-y-auto");
    if (!scroller) return;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160;
    if (nearBottom) scroller.scrollTop = scroller.scrollHeight;
  }, [stream.text, stream.busy]);

  const advisory = lastTask ? tools.find((t) => t.task === lastTask)?.advisory || lastTask === "chat" : false;
  const canReplace = lastWasSelection && !advisory;

  function insert() {
    ui.queueInsert(stream.text.trim(), "insert");
    toast("Inserted at the end", "A snapshot was saved first.", "success");
  }
  function replace() {
    ui.queueInsert(stream.text.trim(), "replace");
    toast("Replaced the selection", "A snapshot was saved first.", "success");
  }
  function copy() {
    navigator.clipboard.writeText(stream.text).then(() => toast("Copied"));
  }

  return (
    <div className="flex min-h-full flex-col">
      <AdultGate open={gate} onClose={() => setGate(false)} />
      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-medium">Companion</h2>
            <span className="text-[11px] text-ink-3">{ctx.craft.label}</span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
            {ctx.voice
              ? `Writing in your voice: ${describeVoice(ctx.voice).slice(0, 3).join(", ").toLowerCase()}.`
              : "Write a few hundred words and the companion will learn your voice from them."}
            {ctx.work && ctx.work.rating !== "everyone" && (
              <>
                {" "}
                Rated {RATING_META[ctx.work.rating].label.toLowerCase()}
                {ctx.work.rating === "mature" || ctx.work.rating === "explicit" ? `, heat ${ctx.work.heat}/5` : ""}.
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {tools.map((t, i) => {
            const disabled = stream.busy || (t.needsSelection && !selection);
            return (
              <button
                key={t.task}
                disabled={disabled}
                onClick={() => run(t.task)}
                data-tip-side="bottom"
                data-tip-align={i % 2 === 0 ? "start" : "end"}
                data-tip={
                  t.needsSelection
                    ? `${t.hint}. Highlight a passage first; the result can replace it or go at the end.`
                    : t.advisory
                      ? `${t.hint}. Comes back as notes for you; nothing is inserted unless you choose.`
                      : `${t.hint}. The result can be inserted at the end of the page.`
                }
                className={`rounded-[10px] border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                  t.advisory ? "border-line hover:border-lilac/60" : "border-line hover:border-aurora/70"
                }`}
              >
                <div className="text-[13px] font-medium text-ink">{t.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{t.hint}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={intensity}
            onChange={setIntensity}
            options={[
              { value: "gentle", label: "Gentle", tip: "Stays close to what is on the page. No surprises." },
              { value: "balanced", label: "Balanced", tip: "Takes one real risk when the text invites it." },
              { value: "wild", label: "Wild", tip: "Surprising and specific, still coherent with your story." },
            ]}
          />
          <Segmented
            value={length}
            onChange={setLength}
            options={[
              { value: "short", label: "Short", tip: "About a paragraph, or a few lines of verse." },
              { value: "medium", label: "Medium", tip: "A few paragraphs, or a stanza or two." },
              { value: "long", label: "Long", tip: "Several paragraphs, or several stanzas." },
            ]}
          />
        </div>

        <div className="relative">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && note.trim()) {
                e.preventDefault();
                run("chat", note.trim());
              }
            }}
            placeholder={selection ? "A note for the companion about the selection, or a question…" : "Steer the next action, or ask the companion a question…"}
            className="pr-10"
          />
          <button
            onClick={() => note.trim() && run("chat", note.trim())}
            disabled={!note.trim() || stream.busy}
            className="absolute bottom-2 right-2 rounded-md p-1.5 text-aurora hover:bg-aurora/10 disabled:opacity-40"
            aria-label="Ask"
          >
            <Send size={15} />
          </button>
        </div>
        {selection && (
          <p className="rounded-[8px] bg-surface-2 px-3 py-2 text-[11px] leading-snug text-ink-2">
            Working on your selection: <span className="italic">“{selection.slice(0, 120)}{selection.length > 120 ? "…" : ""}”</span>
          </p>
        )}
      </div>

      {(stream.text || stream.busy || stream.error) && (
        <div ref={outRef} className="flex flex-1 flex-col border-t border-line scroll-mt-2">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-ink-3">
              {stream.busy ? (
                <span className="inline-flex items-center gap-2" data-tip={stream.model ? `Model: ${stream.model}` : undefined} data-tip-side="bottom">
                  <Spinner className="text-aurora" /> Writing in your voice…
                </span>
              ) : (
                <span data-tip={stream.model ? `Model: ${stream.model}` : undefined} data-tip-side="bottom">
                  {tools.find((t) => t.task === lastTask)?.label ?? "Answer"}
                </span>
              )}
            </span>
            {stream.busy && (
              <button onClick={stream.stop} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
                <Square size={11} /> Stop
              </button>
            )}
          </div>
          <div className="px-4 pb-4">
            {stream.error ? (
              <p className="rounded-[10px] border border-ember/40 bg-ember/5 p-3 text-sm text-ink">{stream.error}</p>
            ) : (
              <div className={`sf-note whitespace-pre-wrap text-ink ${stream.busy ? "sf-streaming" : ""}`}>
                {stream.text}
              </div>
            )}
          </div>
          {!stream.busy && stream.text && !stream.error && (
            <div className="sticky bottom-0 mt-auto flex items-center gap-1.5 border-t border-line bg-surface p-2">
              {!advisory && (
                <Button size="sm" tone="aurora" onClick={insert} icon={<ArrowDownToLine size={13} />} tip="Adds this after the last paragraph. A snapshot is saved first.">
                  Insert at end
                </Button>
              )}
              {canReplace && (
                <Button size="sm" onClick={replace} icon={<Replace size={13} />} tip="Swaps your highlighted passage for this. A snapshot is saved first.">
                  Replace selection
                </Button>
              )}
              <Button size="sm" tone="ghost" onClick={copy} icon={<Copy size={13} />} tip="Copy to the clipboard.">
                Copy
              </Button>
              <Button size="sm" tone="ghost" onClick={() => lastTask && run(lastTask)} className="ml-auto" tip="Ask again for a different take.">
                Again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
