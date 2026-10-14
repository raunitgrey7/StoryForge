"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Sparkles, UserRound, Waypoints, Library, ListOrdered } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { countWords, createDoc, createWork, db, saveProfile, updateWork } from "@/lib/db";
import { upsertEntities } from "@/lib/entities";
import { companionJson } from "@/lib/ai/client";
import { useCompanionContext } from "@/hooks/useCompanionContext";
import { useUI } from "@/lib/store";
import type { CraftId, EntityKind, Tastes, Work } from "@/lib/types";
import { CRAFTS } from "@/lib/crafts";
import { textToHtml } from "../Editor";
import { AdultGate } from "../AdultGate";
import { Button, Empty, Field, Input, Pill, Spinner, Textarea } from "@/components/ui/primitives";
import { TagInput } from "@/components/ui/TagInput";
import { toast } from "@/components/ui/Toast";

type MuseKind = "muse_character" | "muse_plot" | "muse_story" | "muse_chapter" | "muse_book";

interface Character { name: string; role: string; hook: string; description: string; wants: string; wound: string; voice: string; traits: string[] }
interface Plot { title: string; premise: string; turns: string[]; ending: string; tropes: string[] }
interface Story { title: string; craft: string; logline: string; blurb: string; why: string; tags: string[]; heat: number }
interface Chapter { title: string; goal: string; beats: string[]; opening: string; closing: string }
interface Cast { kind: "character" | "place" | "object" | "theme"; name: string; description: string; traits: string[] }
interface Book { title: string; logline: string; blurb: string; tags: string[]; chapters: { title: string; goal: string; summary: string; opening: string }[]; cast: Cast[] }

const GENRES = ["Romance", "Dark romance", "Fantasy", "Sci-fi", "Mystery", "Thriller", "Horror", "Literary", "Historical", "Paranormal", "Fan fiction", "Erotica", "Cozy", "Young adult", "Poetry"];
const TROPES = ["Enemies to lovers", "Slow burn", "Forced proximity", "Found family", "Second chance", "Fake dating", "Grumpy/sunshine", "Chosen one", "Heist", "Time loop", "Hurt/comfort", "Fix-it", "Soulmates", "Arranged marriage", "Rivals"];
const KINKS = ["Praise", "Power exchange", "Bondage", "Teasing", "Public risk", "Size difference", "Voyeurism", "Marking", "Roleplay", "Degradation", "Worship", "Aftercare"];
const NO_WORKS: Work[] = [];

export function MusePanel() {
  const ui = useUI();
  const ctx = useCompanionContext();
  const works = useLiveQuery(() => db.works.toArray(), []) ?? NO_WORKS;
  const [tastesOpen, setTastesOpen] = useState(ctx.profile.tastes.genres.length === 0);
  const [busy, setBusy] = useState<MuseKind | null>(null);
  const [steer, setSteer] = useState("");
  const [gate, setGate] = useState(false);
  const [result, setResult] = useState<{ kind: MuseKind; data: unknown } | null>(null);

  const t = ctx.profile.tastes;
  const patch = (p: Partial<Tastes>) => saveProfile({ tastes: { ...t, ...p } });
  const adultTastes = t.heat >= 3 || t.kinks.length > 0;

  async function ask(kind: MuseKind) {
    if ((kind === "muse_chapter") && !ctx.doc) {
      toast("Open a piece first", "Next-chapter ideas come from what you have written.");
      return;
    }
    if ((adultTastes || ctx.workContext.rating === "explicit" || ctx.workContext.rating === "mature") && !ctx.profile.adultVerified) {
      setGate(true);
      return;
    }
    setBusy(kind);
    setResult(null);
    try {
      const data = await companionJson<unknown>({
        task: kind,
        craft: ctx.craft.id,
        workTitle: ctx.work?.title ?? "",
        logline: ctx.work?.logline,
        text: kind === "muse_story" || kind === "muse_book" ? "" : (ctx.doc?.text ?? ""),
        bible: ctx.entities.slice(0, 40).map((e) => ({ kind: e.kind, name: e.name, description: e.description, traits: e.traits })),
        instruction: steer.trim() || undefined,
        tastes: t,
        library: works.slice(0, 40).map((w) => ({ title: w.title, craft: w.craft, logline: w.logline })),
        ...ctx.workContext,
        rating: adultTastes && !ctx.work ? "explicit" : ctx.workContext.rating,
        heat: ctx.work ? ctx.workContext.heat : t.heat,
      });
      setResult({ kind, data });
    } catch (e) {
      toast("The Muse could not answer", (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function addCharacter(c: Character) {
    if (!ctx.work) {
      toast("Open a work first", "Characters live in a work's bible.");
      return;
    }
    await upsertEntities(ctx.work.id, [{ kind: "character" as EntityKind, name: c.name, description: `${c.role}. ${c.hook} Wants ${c.wants}. Wound: ${c.wound}. Voice: ${c.voice}`, traits: c.traits }]);
    toast("Added to the bible", c.name, "success");
  }

  async function startStory(s: Story) {
    const craft = (Object.keys(CRAFTS) as CraftId[]).find((c) => s.craft.toLowerCase().includes(c) || CRAFTS[c].label.toLowerCase() === s.craft.toLowerCase()) ?? ctx.craft.id;
    const rating = s.heat >= 4 ? "explicit" : s.heat >= 2 ? "mature" : "teen";
    const w = await createWork({ title: s.title, craft, logline: s.logline, tags: s.tags, rating: ctx.profile.adultVerified ? rating : "teen", heat: s.heat });
    const d = await createDoc(w.id, `${CRAFTS[craft].unitLabel} 1`, { goal: s.blurb });
    ui.setWork(w.id);
    ui.setDoc(d.id);
    toast("Started", s.title, "success");
  }

  async function addChapter(c: Chapter) {
    if (!ctx.work) return;
    const d = await createDoc(ctx.work.id, c.title, { goal: `${c.goal}\nBeats: ${c.beats.join(" → ")}`, html: textToHtml(c.opening), text: c.opening, wordCount: countWords(c.opening) });
    ui.setDoc(d.id);
    toast("Chapter added", c.title, "success");
  }

  async function buildBook(b: Book) {
    const rating = ctx.profile.adultVerified ? (t.heat >= 4 ? "explicit" : t.heat >= 2 ? "mature" : "teen") : "teen";
    const w = await createWork({ title: b.title, craft: ctx.craft.id, logline: b.logline, tags: b.tags, rating, heat: t.heat, fandom: ctx.work?.fandom });
    await updateWork(w.id, { logline: b.logline });
    let first: string | null = null;
    for (const [i, ch] of b.chapters.entries()) {
      const d = await createDoc(w.id, ch.title, { order: i, goal: `${ch.goal}\n${ch.summary}`, html: textToHtml(ch.opening), text: ch.opening, wordCount: countWords(ch.opening) });
      if (!first) first = d.id;
    }
    await upsertEntities(w.id, b.cast);
    ui.setWork(w.id);
    ui.setDoc(first);
    toast("Your book is laid out", `${b.chapters.length} chapters and ${b.cast.length} bible entries. Every word is yours to change.`, "success");
  }

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-display text-lg font-medium">Muse</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Recommendations shaped by what you love and what you have already written. A character, a plot, a story, the next chapter, or a whole book.
        </p>
      </div>

      <section className="rounded-[12px] border border-line">
        <button onClick={() => setTastesOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
          <span className="text-sm font-medium">Your tastes</span>
          <span className="flex items-center gap-2 text-[11px] text-ink-3">
            {t.genres.length + t.tropes.length + t.fandoms.length + t.kinks.length} picks · heat {t.heat}/5
            {tastesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {tastesOpen && (
          <div className="sf-enter space-y-3 border-t border-line p-3">
            <Field label="Genres">
              <TagInput value={t.genres} onChange={(v) => patch({ genres: v })} placeholder="What you read and write" suggestions={GENRES} />
            </Field>
            <Field label="Tropes you love">
              <TagInput value={t.tropes} onChange={(v) => patch({ tropes: v })} placeholder="Enter adds" suggestions={TROPES} />
            </Field>
            <Field label="Fandoms">
              <TagInput value={t.fandoms} onChange={(v) => patch({ fandoms: v })} placeholder="Franchises, series, games, bands" />
            </Field>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-2">Preferred heat: {t.heat}/5</span>
              <input type="range" min={0} max={5} value={t.heat} onChange={(e) => patch({ heat: Number(e.target.value) })} className="w-full accent-[var(--gold)]" />
            </div>
            {t.heat >= 3 && (
              <Field label="Kinks and dynamics you enjoy" hint="Adults only. Confirmed once, kept in your profile.">
                <TagInput value={t.kinks} onChange={(v) => patch({ kinks: v })} placeholder="Optional" suggestions={KINKS} />
              </Field>
            )}
            <Field label="Never suggest">
              <TagInput value={t.avoid} onChange={(v) => patch({ avoid: v })} placeholder="Hard limits, tropes you hate, anything off the table" />
            </Field>
            <Field label="Anything else">
              <Textarea rows={2} value={t.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Favourite authors, what you are in the mood for, what you are tired of" />
            </Field>
          </div>
        )}
      </section>

      <Input value={steer} onChange={(e) => setSteer(e.target.value)} placeholder="Optional steer: “a villain”, “set in Lagos”, “make it hurt”…" className="h-9 text-xs" />

      <div className="grid grid-cols-2 gap-1.5">
        <MuseButton icon={<UserRound size={14} />} label="A character" hint={ctx.work ? `for ${ctx.work.title}` : "for anything"} tip="Four characters built from your tastes and this work's bible: hook, wants, wound, voice. Add any of them to the bible." busy={busy === "muse_character"} disabled={busy !== null} onClick={() => ask("muse_character")} />
        <MuseButton icon={<Waypoints size={14} />} align="end" label="A plot" hint={ctx.work ? `for ${ctx.work.title}` : "from your tastes"} tip="Four plots with premise, turns and an ending. Insert one as notes or take it as the logline." busy={busy === "muse_plot"} disabled={busy !== null} onClick={() => ask("muse_plot")} />
        <MuseButton icon={<Library size={14} />} label="A story to write next" hint="five ideas, one stretch" tip="Five ideas for your next work, shaped by your library and tastes. Any of them can start as a new work." busy={busy === "muse_story"} disabled={busy !== null} onClick={() => ask("muse_story")} />
        <MuseButton icon={<ListOrdered size={14} />} align="end" label="The next chapter" hint={ctx.doc ? "three ways forward" : "open a piece first"} tip="Three ways the next chapter could go, each with beats and an opening. Add one and keep writing." busy={busy === "muse_chapter"} disabled={busy !== null || !ctx.doc} onClick={() => ask("muse_chapter")} />
        <MuseButton icon={<BookOpen size={14} />} label="A whole book" hint="title, blurb, chapters, cast" tip="A full blueprint: title, blurb, ten or more chapters with openings, and a cast. It becomes a new work you can start in immediately." busy={busy === "muse_book"} disabled={busy !== null} onClick={() => ask("muse_book")} wide />
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-xs text-ink-3">
          <Spinner className="text-aurora" /> The Muse is reading your tastes{busy === "muse_book" ? " and laying out a book. This one takes a minute." : "…"}
        </p>
      )}

      {result?.kind === "muse_character" && (
        <ul className="space-y-2">
          {(result.data as { characters: Character[] }).characters.map((c, i) => (
            <li key={i} className="sf-enter rounded-[12px] border border-line p-3">
              <div className="font-display text-[15px] font-medium">{c.name}</div>
              <div className="text-[11px] text-ink-3">{c.role}</div>
              <p className="mt-1 text-xs italic text-ink">{c.hook}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{c.description}</p>
              <p className="mt-1 text-xs text-ink-2"><span className="text-aurora">Wants.</span> {c.wants} <span className="text-ember">Wound.</span> {c.wound}</p>
              <p className="mt-1 text-xs text-ink-2"><span className="text-lilac">Voice.</span> {c.voice}</p>
              <div className="mt-2 flex flex-wrap gap-1">{c.traits.map((tr) => <Pill key={tr} hue={42}>{tr}</Pill>)}</div>
              <Button size="sm" tone="gold" className="mt-2" onClick={() => addCharacter(c)}>Add to the bible</Button>
            </li>
          ))}
        </ul>
      )}

      {result?.kind === "muse_plot" && (
        <ul className="space-y-2">
          {(result.data as { plots: Plot[] }).plots.map((p, i) => (
            <li key={i} className="sf-enter rounded-[12px] border border-line p-3">
              <div className="font-display text-[15px] font-medium">{p.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{p.premise}</p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-ink-2">{p.turns.map((tu, j) => <li key={j}>{tu}</li>)}</ol>
              <p className="mt-1 text-xs text-ink"><span className="text-aurora">Ends.</span> {p.ending}</p>
              <div className="mt-2 flex flex-wrap gap-1">{p.tropes.map((tr) => <Pill key={tr}>{tr}</Pill>)}</div>
              <div className="mt-2 flex gap-1.5">
                {ctx.doc && <Button size="sm" onClick={() => { ui.queueInsert(`[Plot: ${p.title}]\n${p.premise}\n${p.turns.map((x, j) => `${j + 1}. ${x}`).join("\n")}\nEnding: ${p.ending}`, "insert"); toast("Inserted as notes"); }}>Insert as notes</Button>}
                {ctx.work && <Button size="sm" tone="ghost" onClick={async () => { await updateWork(ctx.work!.id, { logline: p.premise }); toast("Logline updated"); }}>Use as logline</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {result?.kind === "muse_story" && (
        <ul className="space-y-2">
          {(result.data as { stories: Story[] }).stories.map((s, i) => (
            <li key={i} className="sf-enter rounded-[12px] border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-[15px] font-medium">{s.title}</div>
                <span className="text-[11px] text-ink-3">{s.craft} · heat {s.heat}</span>
              </div>
              <p className="mt-1 text-xs italic text-ink">{s.logline}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.blurb}</p>
              <p className="mt-1 text-[11px] text-ink-3">{s.why}</p>
              <div className="mt-2 flex flex-wrap gap-1">{s.tags.slice(0, 8).map((tg) => <Pill key={tg}>{tg}</Pill>)}</div>
              <Button size="sm" tone="gold" className="mt-2" onClick={() => startStory(s)} icon={<Sparkles size={13} />}>Start this work</Button>
            </li>
          ))}
        </ul>
      )}

      {result?.kind === "muse_chapter" && (
        <ul className="space-y-2">
          {(result.data as { chapters: Chapter[] }).chapters.map((c, i) => (
            <li key={i} className="sf-enter rounded-[12px] border border-line p-3">
              <div className="font-display text-[15px] font-medium">{c.title}</div>
              <p className="mt-0.5 text-xs text-ink-2">{c.goal}</p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-ink-2">{c.beats.map((b, j) => <li key={j}>{b}</li>)}</ol>
              <p className="mt-2 border-l-2 border-line pl-2 font-display text-[13px] italic leading-relaxed text-ink">{c.opening}</p>
              <p className="mt-1 text-[11px] text-ink-3">…{c.closing}</p>
              <Button size="sm" tone="gold" className="mt-2" onClick={() => addChapter(c)}>Add as the next chapter</Button>
            </li>
          ))}
        </ul>
      )}

      {result?.kind === "muse_book" && (() => {
        const b = result.data as Book;
        return (
          <div className="sf-enter rounded-[12px] border border-gold/50 bg-gold/5 p-3">
            <div className="font-display text-xl font-medium leading-tight">{b.title}</div>
            <p className="mt-1 text-xs italic text-ink">{b.logline}</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">{b.blurb}</p>
            <div className="mt-2 flex flex-wrap gap-1">{b.tags.slice(0, 10).map((tg) => <Pill key={tg}>{tg}</Pill>)}</div>
            <ol className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {b.chapters.map((ch, i) => (
                <li key={i} className="rounded-[8px] bg-surface px-2 py-1.5">
                  <div className="font-medium text-ink">{i + 1}. {ch.title}</div>
                  <div className="text-ink-2">{ch.summary}</div>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-ink-3">Cast: {b.cast.map((c) => c.name).join(", ")}</p>
            <Button tone="gold" className="mt-3 w-full" onClick={() => buildBook(b)} icon={<BookOpen size={14} />}>
              Lay out this book as a new work
            </Button>
          </div>
        );
      })()}

      {!result && !busy && ctx.profile.tastes.genres.length === 0 && (
        <Empty title="Tell the Muse what you love" body="Pick a few genres and tropes above. The more it knows, the better it recommends. Fandoms and heat matter too." />
      )}

      <AdultGate open={gate} onClose={() => setGate(false)} />
    </div>
  );
}

function MuseButton({ icon, label, hint, tip, busy, disabled, onClick, wide, align = "start" }: { icon: React.ReactNode; label: string; hint: string; tip: string; busy: boolean; disabled: boolean; onClick: () => void; wide?: boolean; align?: "start" | "end" }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      data-tip={tip}
      data-tip-side="bottom"
      data-tip-align={align}
      className={`rounded-[10px] border border-line px-3 py-2 text-left transition-colors hover:border-gold/70 disabled:opacity-40 ${wide ? "col-span-2" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">{busy ? <Spinner className="text-gold" /> : icon} {label}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{hint}</div>
    </button>
  );
}
