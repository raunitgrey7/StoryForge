"use client";

import { useMemo } from "react";
import { analyze, readabilityLabel } from "@/lib/analysis";
import { useCompanionContext } from "@/hooks/useCompanionContext";
import { describeVoice } from "@/lib/voice";
import { Empty } from "@/components/ui/primitives";

export function PulsePanel() {
  const { doc, craft, voice } = useCompanionContext();
  const isVerse = craft.id === "poetry" || craft.id === "lyrics";
  const pulse = useMemo(() => (doc ? analyze(doc.text, isVerse) : null), [doc, isVerse]);

  if (!doc || !pulse) {
    return (
      <div className="p-4">
        <Empty title="Nothing to measure yet" body="Open a piece and the pulse updates as you type. Everything here is computed on your device." />
      </div>
    );
  }
  if (pulse.words < 20) {
    return (
      <div className="p-4">
        <Empty title="Keep going" body="The pulse needs a paragraph or two before it says anything useful." />
      </div>
    );
  }

  const show = new Set(craft.pulse);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="font-display text-lg font-medium">Pulse</h2>
        <p className="mt-0.5 text-xs text-ink-3">Instant, local, heuristic. A place to look, not a verdict.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Words" value={pulse.words.toLocaleString()} />
        <Stat label={isVerse ? "Lines" : "Sentences"} value={pulse.sentences.toLocaleString()} />
        <Stat label="Read" value={`${Math.max(1, Math.round(pulse.readingMinutes))} min`} />
      </div>

      {show.has("tension") && pulse.paragraphsPulse.length > 1 && (
        <Section title="Tension across the piece" hint="Rises with short sentences, urgency words and punctuation.">
          <TensionChart pulse={pulse.paragraphsPulse} />
        </Section>
      )}

      {show.has("rhythm") && (
        <Section title="Rhythm" hint={isVerse ? "Syllables per line." : "Sentence length, in order. Flat bars read as monotone."}>
          {isVerse ? <Bars values={pulse.syllablesPerLine} max={Math.max(12, ...pulse.syllablesPerLine)} /> : <RhythmBars text={doc.text} />}
          {!isVerse && (
            <p className="mt-2 text-[11px] text-ink-3">
              Average {pulse.avgSentence.toFixed(1)} words, spread ±{pulse.sentenceSpread.toFixed(1)}, longest {pulse.longestSentence}.
            </p>
          )}
        </Section>
      )}

      {show.has("sound") && isVerse && (
        <Section title="Sound" hint="Rhyme scheme guessed from line endings.">
          <div className="font-display text-2xl tracking-[0.3em]">{pulse.rhymeScheme || "—"}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {pulse.lineEndings.slice(0, 16).map((w, i) => (
              <span key={i} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                {w}
              </span>
            ))}
          </div>
        </Section>
      )}

      {show.has("readability") && (
        <Section title="Readability">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl">{readabilityLabel(pulse.flesch)}</span>
            <span className="text-xs text-ink-3">Flesch {Math.round(pulse.flesch)} · grade {pulse.grade.toFixed(0)}</span>
          </div>
          <Meter value={pulse.flesch / 100} />
        </Section>
      )}

      {show.has("dialogue") && (
        <Section title="Dialogue and narration">
          <Meter value={pulse.dialogueRatio} label={`${Math.round(pulse.dialogueRatio * 100)}% dialogue`} />
        </Section>
      )}

      {(show.has("clarity") || show.has("readability")) && (
        <Section title="Habits" hint="Per hundred words or sentences. Not wrong, just visible.">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Row k="Adverbs (-ly)" v={pulse.adverbRate.toFixed(1)} warn={pulse.adverbRate > 4} />
            <Row k="Passive voice" v={`${pulse.passiveRate.toFixed(0)}%`} warn={pulse.passiveRate > 20} />
            <Row k="Filler words" v={pulse.fillerRate.toFixed(1)} warn={pulse.fillerRate > 2.5} />
            <Row k="Weak verbs" v={String(pulse.weakVerbs)} warn={pulse.weakVerbs > pulse.sentences * 0.8} />
            <Row k="Vocabulary" v={`${Math.round(pulse.vocabRichness * 100)}%`} />
          </div>
        </Section>
      )}

      {(pulse.repeats.length > 0 || pulse.cliches.length > 0) && (
        <Section title="Worth a second look">
          {pulse.cliches.length > 0 && (
            <div className="mb-2">
              <div className="text-[11px] text-ink-3">Phrases readers have met before</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {pulse.cliches.map((c) => (
                  <span key={c} className="rounded bg-ember/10 px-1.5 py-0.5 text-[11px] text-ember">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {pulse.repeats.length > 0 && (
            <div>
              <div className="text-[11px] text-ink-3">Words leaned on</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {pulse.repeats.map((r) => (
                  <span key={r.word} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                    {r.word} <span className="text-ink-3">×{r.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {!isVerse && (
        <Section title="Senses" hint="How often each sense is on the page.">
          <div className="grid grid-cols-5 gap-1 text-center">
            {(Object.entries(pulse.sensory) as [string, number][]).map(([k, v]) => (
              <div key={k} className="rounded-[8px] bg-surface-2 py-2">
                <div className="font-display text-lg">{v}</div>
                <div className="text-[10px] text-ink-3">{k}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {voice && (
        <Section title="Your voice, as the companion hears it" hint={`From ${voice.words.toLocaleString()} words across this work.`}>
          <ul className="space-y-1 text-xs text-ink-2">
            {describeVoice(voice).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {voice.signatureWords.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-3">Reaches for: {voice.signatureWords.slice(0, 8).join(", ")}</p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {hint && <p className="mb-2 text-[11px] text-ink-3">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2">
      <div className="font-display text-xl leading-tight">{value}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <>
      <span className="text-ink-2">{k}</span>
      <span className={`text-right tabular-nums ${warn ? "text-ember" : "text-ink"}`}>{v}</span>
    </>
  );
}

function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
      </div>
      {label && <div className="mt-1 text-[11px] text-ink-3">{label}</div>}
    </div>
  );
}

function TensionChart({ pulse }: { pulse: { tension: number; sentiment: number; preview: string }[] }) {
  const w = 340;
  const h = 90;
  const n = pulse.length;
  const pts = pulse.map((p, i) => [(i / Math.max(1, n - 1)) * (w - 8) + 4, h - 6 - p.tension * (h - 14)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Tension curve by paragraph">
      <defs>
        <linearGradient id="sf-tension" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--ember)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--ember)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sf-tension)" />
      <path d={d} fill="none" stroke="var(--ember)" strokeWidth="1.8" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill={pulse[i].sentiment > 0.2 ? "var(--aurora)" : pulse[i].sentiment < -0.2 ? "var(--ember)" : "var(--lilac)"}>
          <title>{`Paragraph ${i + 1}: ${pulse[i].preview}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function RhythmBars({ text }: { text: string }) {
  const lens = useMemo(
    () =>
      text
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?…]["'”’)\]]?)\s+(?=[A-Z"'“‘(\[])/)
        .map((s) => s.split(/\s+/).filter(Boolean).length)
        .filter((n) => n > 0)
        .slice(0, 120),
    [text],
  );
  return <Bars values={lens} max={Math.max(30, ...lens)} />;
}

function Bars({ values, max }: { values: number[]; max: number }) {
  return (
    <div className="flex h-14 items-end gap-[2px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[2px] bg-lilac/80"
          style={{ height: `${Math.max(4, (v / max) * 100)}%`, minWidth: 2 }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}
