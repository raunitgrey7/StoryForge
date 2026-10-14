"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ArrowRight, BookOpenText, FileDown, Image as ImageIcon, PenLine, Sparkles } from "lucide-react";
import { illustrate } from "@/lib/illustrate";
import { countWords, createDoc, createWork, db, getSetting, setSetting, updateWork } from "@/lib/db";
import { upsertEntities } from "@/lib/entities";
import { companionJson } from "@/lib/ai/client";
import { buildVoiceCard } from "@/lib/voice";
import { DEFAULT_BRIEF, FORMS, HEAT, LANGUAGE, POV, formOf, heatOf, type Brief } from "@/lib/commission";
import type { CommissionOutline } from "@/lib/ai/prompts";
import { useProfile } from "@/hooks/useProfile";
import { textToHtml } from "@/components/studio/Editor";
import { AdultGate } from "@/components/studio/AdultGate";
import { Listen } from "@/components/reader/Listen";
import { PdfDialog } from "@/components/reader/PdfDialog";
import { Button, Field, Input, Spinner, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";
import type { Doc, Work } from "@/lib/types";

const STEPS = ["What", "Heat", "Language", "Length", "Your imagination", "Write it"] as const;
const GENRES = ["Romance", "Dark romance", "Fantasy", "Sci-fi", "Mystery", "Thriller", "Horror", "Literary", "Historical", "Paranormal", "Erotica", "Cozy", "Adventure", "Comedy", "Children's", "Fan fiction"];

/**
 * The commission wizard: the human chooses every option and writes the whole
 * brief; the companion writes the piece and saves it as a work.
 */
export function Commission() {
  const router = useRouter();
  const profile = useProfile();
  const works = useLiveQuery(() => db.works.toArray(), []);
  const docsAll = useLiveQuery(() => db.docs.toArray(), []);
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [step, setStep] = useState(0);
  const [gate, setGate] = useState(false);
  const [phase, setPhase] = useState<"idle" | "outline" | "writing" | "done" | "error">("idle");
  const [status, setStatus] = useState("");
  const [live, setLive] = useState("");
  const [outline, setOutline] = useState<CommissionOutline | null>(null);
  const [result, setResult] = useState<{ work: Work; docs: Doc[] } | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const adultOk = useRef(false);
  const liveRef = useRef<HTMLDivElement>(null);

  // Remember the brief between visits.
  useEffect(() => {
    getSetting<Brief | null>("sf:commission:brief", null).then((b) => b && setBrief({ ...DEFAULT_BRIEF, ...b }));
  }, []);
  useEffect(() => {
    if (brief !== DEFAULT_BRIEF) setSetting("sf:commission:brief", brief);
  }, [brief]);

  useEffect(() => {
    if (phase === "writing" && liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [live, phase]);

  const set = (patch: Partial<Brief>) => setBrief((b) => ({ ...b, ...patch }));
  const form = formOf(brief);
  const heat = heatOf(brief);
  const isVerse = brief.form === "poem" || brief.form === "lyrics";
  const adult = profile.adultVerified || adultOk.current;
  const needsAdult = brief.heat !== "none" && !adult;

  const voice = useMemo(() => {
    if (brief.language !== "mine" || !docsAll) return null;
    return buildVoiceCard(docsAll.map((d) => d.text).filter(Boolean));
  }, [brief.language, docsAll]);

  const canWrite = brief.imagination.trim().length >= 20;

  async function streamPiece(body: Record<string, unknown>, onText: (t: string) => void): Promise<string> {
    const ac = new AbortController();
    abortRef.current = ac;
    const res = await fetch("/api/ai/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `The companion answered with ${res.status}.`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let acc = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      onText(acc);
    }
    return acc.replace(/\n\n\[[^\]]*\]\s*$/, "").trim();
  }

  async function write() {
    if (needsAdult) {
      setGate(true);
      return;
    }
    if (!canWrite) {
      toast("Tell it your imagination first", "A few sentences at least: who, where, what happens, how it ends.");
      return;
    }
    setPhase("outline");
    setLive("");
    setResult(null);
    const common = {
      task: "commission",
      craft: form.craft,
      workTitle: brief.title || "Commission",
      docTitle: "",
      text: "",
      brief,
      adult,
      voice,
      rating: heat.rating,
      heat: heat.heat,
      fandom: brief.fandom || undefined,
    };
    try {
      let plan: CommissionOutline | null = null;
      if (brief.form === "book") {
        setStatus("Planning the book: title, blurb, chapters, cast");
        plan = await companionJson<CommissionOutline>({
          task: "commission_outline",
          craft: form.craft,
          workTitle: brief.title || "Commission",
          text: "",
          brief,
          adult,
          voice,
          rating: heat.rating,
          heat: heat.heat,
        });
        plan.chapters = plan.chapters.slice(0, brief.chapters);
        setOutline(plan);
      }

      const work = await createWork({
        title: plan?.title || brief.title || (brief.genre ? `A ${brief.genre.toLowerCase()} ${form.label.toLowerCase().replace(/^a |^one /, "")}` : "Commissioned piece"),
        craft: brief.fandom ? "fanfic" : brief.form === "book" ? (/(romance|erotica)/i.test(brief.genre) ? "romance" : "novel") : form.craft,
        logline: plan?.logline || brief.imagination.slice(0, 180).replace(/\s+/g, " "),
        rating: heat.rating,
        heat: heat.heat,
        fandom: brief.fandom || undefined,
        tags: [brief.genre, brief.language === "classic" ? "Classic English" : "", brief.heat !== "none" ? `Heat: ${brief.heat}` : ""].filter(Boolean),
      });
      if (plan) await upsertEntities(work.id, plan.cast);

      const written: Doc[] = [];
      setPhase("writing");
      if (brief.form === "book" && plan) {
        let recap = "";
        for (const [i, ch] of plan.chapters.entries()) {
          setStatus(`Writing chapter ${i + 1} of ${plan.chapters.length}: ${ch.title}`);
          setLive("");
          const text = await streamPiece({ ...common, docTitle: ch.title, outline: plan, chapterIndex: i, previousSummary: recap }, setLive);
          const doc = await createDoc(work.id, ch.title, { html: textToHtml(text), text, wordCount: countWords(text), order: i, goal: ch.summary, status: "done" });
          written.push(doc);
          recap = `${recap}${recap ? "\n" : ""}Chapter ${i + 1} (${ch.title}): ${ch.summary} Ends: ${text.slice(-500).replace(/\s+/g, " ")}`.slice(-6000);
        }
        await updateWork(work.id, { logline: plan.logline });
      } else {
        setStatus(`Writing ${form.label.toLowerCase()}`);
        const text = await streamPiece({ ...common, docTitle: brief.title || form.label }, setLive);
        const title = brief.title || (isVerse ? text.split("\n")[0].slice(0, 60) : `${form.label.replace(/^A |^One /, "")}`);
        const html = isVerse ? text.split(/\n/).map((l) => (l.trim() ? `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "<p></p>")).join("") : textToHtml(text);
        const doc = await createDoc(work.id, brief.title || (isVerse ? title : "The piece"), { html, text, wordCount: countWords(text), order: 0, status: "done" });
        written.push(doc);
        if (!brief.title) await updateWork(work.id, { title: isVerse ? title : work.title });
      }
      const finalWork = (await db.works.get(work.id))!;
      setResult({ work: finalWork, docs: written });
      setPhase("done");
      setStatus("Saved to your library.");
      toast("Written and saved", finalWork.title, "success");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setPhase("idle");
        setStatus("");
        return;
      }
      setPhase("error");
      setStatus((e as Error).message);
      toast("The commission stopped", (e as Error).message, "error");
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  const paragraphsForListen = useMemo(() => (result ? result.docs.flatMap((d) => d.text.split(/\n{2,}|\n/).filter((p) => p.trim())) : []), [result]);

  return (
    <div className="min-h-[100dvh] bg-bg text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft size={16} /> Studio
        </Link>
        <div className="font-display text-lg font-semibold">Commission</div>
        <span className="text-xs text-ink-3">{works ? `${works.length} works` : ""}</span>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 sm:px-6">
        <h1 className="font-display text-3xl font-medium leading-tight sm:text-4xl" style={{ fontVariationSettings: '"opsz" 96, "SOFT" 60, "WONK" 1' }}>
          You imagine it. It gets written.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          Choose the form, the heat, the language and the length, then hand over the whole idea. The piece is written to your brief and saved to your library, ready to read, listen to, edit, or download as a typeset PDF.
        </p>

        {phase === "idle" || phase === "error" ? (
          <>
            <ol className="mt-8 flex flex-wrap gap-1.5">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    onClick={() => setStep(i)}
                    className={`rounded-full border px-3 py-1 text-xs ${i === step ? "border-gold bg-gold/10 text-ink" : i < step ? "border-line text-ink-2" : "border-line text-ink-3"}`}
                  >
                    {i + 1}. {s}
                  </button>
                </li>
              ))}
            </ol>

            <section className="sf-enter mt-6 rounded-[16px] border border-line bg-surface p-5 sm:p-6" key={step}>
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-medium">What should it be?</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {FORMS.map((f) => (
                        <button key={f.id} onClick={() => set({ form: f.id })} data-tip={f.blurb} data-tip-side="bottom" data-tip-align="start" className={`rounded-[12px] border p-3 text-left ${brief.form === f.id ? "border-gold bg-gold/10" : "border-line hover:border-line-2"}`}>
                          <div className="text-sm font-medium">{f.label}</div>
                          <div className="mt-0.5 text-[11px] text-ink-3">{f.blurb}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="Genre and mood" hint="Free text. Combine anything.">
                    <Input value={brief.genre} onChange={(e) => set({ genre: e.target.value })} placeholder="Dark fantasy romance with a slow burn" />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {GENRES.map((g) => (
                        <button key={g} onClick={() => set({ genre: brief.genre ? `${brief.genre}, ${g.toLowerCase()}` : g })} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-3 hover:border-line-2 hover:text-ink">
                          + {g}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Fandom (optional)" hint="Name a franchise and the piece is written inside its canon.">
                    <Input value={brief.fandom ?? ""} onChange={(e) => set({ fandom: e.target.value })} placeholder="Harry Potter, The Witcher, Bridgerton, Naruto…" />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="font-display text-xl font-medium">Sexual content?</h2>
                  <p className="mt-1 text-sm text-ink-2">Every character in an intimate scene is an adult. That line does not move.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {HEAT.map((h) => (
                      <button key={h.id} onClick={() => set({ heat: h.id })} data-tip={h.blurb} data-tip-side="bottom" data-tip-align="start" className={`rounded-[12px] border p-3 text-left ${brief.heat === h.id ? "border-gold bg-gold/10" : "border-line hover:border-line-2"}`}>
                        <div className="text-sm font-medium">{h.label}</div>
                        <div className="mt-0.5 text-[11px] text-ink-3">{h.blurb}</div>
                      </button>
                    ))}
                  </div>
                  {needsAdult && <p className="mt-3 text-xs text-gold">You will confirm you are an adult before this is written.</p>}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-medium">What kind of English?</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {LANGUAGE.map((l) => (
                        <button key={l.id} onClick={() => set({ language: l.id })} data-tip={l.blurb} data-tip-side="bottom" data-tip-align="start" className={`rounded-[12px] border p-3 text-left ${brief.language === l.id ? "border-gold bg-gold/10" : "border-line hover:border-line-2"}`}>
                          <div className="text-sm font-medium">{l.label}</div>
                          <div className="mt-0.5 text-[11px] text-ink-3">{l.blurb}</div>
                        </button>
                      ))}
                    </div>
                    {brief.language === "mine" && !voice && <p className="mt-2 text-xs text-ink-3">Your library is too small for a voice card yet; modern English will be used until you have written a few hundred words.</p>}
                  </div>
                  {!isVerse && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Point of view">
                        <select value={brief.pov} onChange={(e) => set({ pov: e.target.value as Brief["pov"] })} className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm">
                          {POV.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tense">
                        <select value={brief.tense} onChange={(e) => set({ tense: e.target.value as Brief["tense"] })} className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm">
                          <option value="past">Past</option>
                          <option value="present">Present</option>
                        </select>
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-medium">How long?</h2>
                  {brief.form === "book" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={`Chapters: ${brief.chapters}`} hint="Each chapter is written in turn from an outline. A 12-chapter book at 1,500 words takes about six minutes.">
                        <input type="range" min={3} max={24} value={brief.chapters} onChange={(e) => set({ chapters: Number(e.target.value) })} className="w-full accent-[var(--gold)]" />
                      </Field>
                      <Field label={`Words per chapter: ${brief.wordsPerChapter.toLocaleString()}`}>
                        <input type="range" min={600} max={3000} step={100} value={brief.wordsPerChapter} onChange={(e) => set({ wordsPerChapter: Number(e.target.value) })} className="w-full accent-[var(--gold)]" />
                      </Field>
                    </div>
                  )}
                  {(brief.form === "story" || brief.form === "screenplay") && (
                    <Field label={`About ${brief.wordsPerChapter.toLocaleString()} words`}>
                      <input type="range" min={300} max={4000} step={100} value={brief.wordsPerChapter} onChange={(e) => set({ wordsPerChapter: Number(e.target.value) })} className="w-full accent-[var(--gold)]" />
                    </Field>
                  )}
                  {brief.form === "poem" && (
                    <Field label={`About ${brief.poemLines} lines`}>
                      <input type="range" min={4} max={120} step={2} value={brief.poemLines} onChange={(e) => set({ poemLines: Number(e.target.value) })} className="w-full accent-[var(--gold)]" />
                    </Field>
                  )}
                  {brief.form === "lyrics" && <p className="text-sm text-ink-2">A song is as long as it needs to be: two or more verses, a chorus, a bridge.</p>}
                  <Field label="Title (optional)">
                    <Input value={brief.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Leave blank and one will be chosen" />
                  </Field>
                  <p className="text-xs text-ink-3">
                    Total: about {brief.form === "book" ? (brief.chapters * brief.wordsPerChapter).toLocaleString() : brief.form === "poem" ? `${brief.poemLines} lines` : brief.form === "lyrics" ? "a song" : brief.wordsPerChapter.toLocaleString()} {brief.form === "poem" || brief.form === "lyrics" ? "" : "words"}.
                  </p>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-medium">Your imagination</h2>
                  <p className="text-sm text-ink-2">Everything you want in it. Characters and what they want, the world, the plot, the ending, scenes that must happen, lines you can hear. The more you give, the more it is yours.</p>
                  <Textarea rows={12} value={brief.imagination} onChange={(e) => set({ imagination: e.target.value })} placeholder={"Two rival mapmakers are hired to chart a city that moves at night. She has never told a lie; he has never told the truth. By the end they must decide which of them the city will keep…"} className="text-[15px] leading-relaxed" />
                  <Field label="Never include (optional)">
                    <Input value={brief.avoid ?? ""} onChange={(e) => set({ avoid: e.target.value })} placeholder="Cheating, animal harm, sad endings…" />
                  </Field>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-medium">Ready to write</h2>
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <Row k="Form" v={form.label} />
                    <Row k="Genre" v={brief.genre || "Not set"} />
                    {brief.fandom && <Row k="Fandom" v={brief.fandom} />}
                    <Row k="Heat" v={heat.label} />
                    <Row k="Language" v={LANGUAGE.find((l) => l.id === brief.language)?.label ?? ""} />
                    {!isVerse && <Row k="Voice" v={`${POV.find((p) => p.id === brief.pov)?.label}, ${brief.tense} tense`} />}
                    <Row k="Length" v={brief.form === "book" ? `${brief.chapters} chapters × ${brief.wordsPerChapter.toLocaleString()} words` : brief.form === "poem" ? `${brief.poemLines} lines` : brief.form === "lyrics" ? "a song" : `${brief.wordsPerChapter.toLocaleString()} words`} />
                  </dl>
                  <p className="rounded-[10px] bg-surface-2 p-3 text-sm leading-relaxed text-ink-2">{brief.imagination.trim() ? brief.imagination.slice(0, 600) : "No imagination written yet. Go back a step."}{brief.imagination.length > 600 ? "…" : ""}</p>
                  {phase === "error" && <p className="rounded-[10px] border border-ember/40 bg-ember/5 p-3 text-sm">{status}</p>}
                  <Button tone="gold" size="lg" onClick={write} disabled={!canWrite} icon={<Sparkles size={16} />} className="w-full sm:w-auto">
                    Write it
                  </Button>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                <Button tone="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} icon={<ArrowLeft size={15} />}>
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep((s) => s + 1)} icon={<ArrowRight size={15} />}>
                    Next
                  </Button>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <section className="sf-enter mt-8 rounded-[16px] border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-ink-2">
                {phase !== "done" && <Spinner className="text-aurora" />}
                <span>{status}</span>
              </div>
              {phase !== "done" ? (
                <Button size="sm" tone="ghost" onClick={cancel}>
                  Stop
                </Button>
              ) : null}
            </div>

            {outline && phase !== "done" && (
              <ol className="mt-4 grid gap-1 text-xs text-ink-3 sm:grid-cols-2">
                {outline.chapters.map((c, i) => (
                  <li key={i} className={status.includes(`chapter ${i + 1} of`) ? "text-gold" : ""}>
                    {i + 1}. {c.title}
                  </li>
                ))}
              </ol>
            )}

            {phase !== "done" && (
              <div ref={liveRef} className="sf-page mt-4 max-h-[50vh] overflow-y-auto rounded-[12px] border border-line p-5">
                <div className={`sf-prose whitespace-pre-wrap ${live ? "sf-streaming" : ""}`} data-craft={isVerse ? "poetry" : form.craft}>
                  {live || "…"}
                </div>
              </div>
            )}

            {phase === "done" && result && (
              <div className="mt-4">
                <div className="font-display text-2xl font-medium">{result.work.title}</div>
                <p className="mt-1 text-sm italic text-ink-2">{result.work.logline}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {result.docs.length} {result.docs.length === 1 ? "piece" : "chapters"} · {result.docs.reduce((n, d) => n + d.wordCount, 0).toLocaleString()} words · saved to your library
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button tone="gold" onClick={() => router.push(`/read/${result.work.id}`)} icon={<BookOpenText size={15} />}>
                    Read it
                  </Button>
                  <Button onClick={() => router.push(`/studio?work=${result.work.id}`)} icon={<PenLine size={15} />}>
                    Edit in the studio
                  </Button>
                  <Button
                    onClick={async () => {
                      for (const d of result.docs) {
                        setDrawing(d.title);
                        try {
                          const ill = await illustrate(result.work, d);
                          setDrawn((m) => ({ ...m, [d.id]: ill.dataUrl }));
                        } catch (e) {
                          toast("Could not illustrate", (e as Error).message, "error");
                          break;
                        }
                      }
                      setDrawing(null);
                    }}
                    disabled={drawing !== null}
                    icon={drawing ? <Spinner /> : <ImageIcon size={15} />}
                    tip="Draw one illustration per chapter from its text. They appear here, in the reader, and at chapter heads in the PDF."
                  >
                    {drawing ? `Drawing ${drawing}` : "Illustrate"}
                  </Button>
                  <Button onClick={() => setPdfOpen(true)} icon={<FileDown size={15} />}>
                    Download PDF
                  </Button>
                  <Listen paragraphs={paragraphsForListen} />
                </div>
                <div className="sf-page mt-5 max-h-[60vh] overflow-y-auto rounded-[12px] border border-line p-5">
                  {result.docs.map((d) => (
                    <article key={d.id} className="mb-8">
                      {result.docs.length > 1 && <h3 className="font-display mb-3 text-xl font-medium text-[#221c3d]">{d.title}</h3>}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {drawn[d.id] && <img src={drawn[d.id]} alt={d.title} className="mb-4 w-full rounded-[6px] border border-[#e5dff3]" />}
                      <div className="sf-prose" data-craft={isVerse ? "poetry" : form.craft} dangerouslySetInnerHTML={{ __html: d.html }} />
                    </article>
                  ))}
                </div>
                <div className="mt-4">
                  <Button tone="ghost" onClick={() => { setPhase("idle"); setStep(4); }}>
                    Commission another
                  </Button>
                </div>
                <PdfDialog work={result.work} docs={result.docs} open={pdfOpen} onClose={() => setPdfOpen(false)} />
              </div>
            )}
          </section>
        )}
      </main>
      <AdultGate open={gate} onClose={() => setGate(false)} onConfirmed={() => { adultOk.current = true; setTimeout(write, 50); }} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-ink-3">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
