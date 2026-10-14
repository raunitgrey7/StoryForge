"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { updateWork } from "@/lib/db";
import { craftOf } from "@/lib/crafts";
import { RATING_META, type Rating, type Work } from "@/lib/types";
import { useProfile } from "@/hooks/useProfile";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { TagInput } from "@/components/ui/TagInput";
import { AdultGate } from "./AdultGate";
import { toast } from "@/components/ui/Toast";

const COMMON_TAGS = ["Slow burn", "Enemies to lovers", "Hurt/comfort", "Fix-it", "Alternate universe", "Fluff", "Angst", "Found family", "Friends to lovers", "Forced proximity", "Second chance", "Fake dating", "Grumpy/sunshine", "Dark romance", "Praise kink", "Power exchange"];
const COMMON_WARNINGS = ["Graphic violence", "Major character death", "Dubious consent", "Non-consent", "Underage (none)", "Self-harm", "Abuse"];
const HEAT_LABELS = ["Closed door", "Warm", "Sensual", "Steamy", "Explicit", "Very explicit"];

export function WorkSettingsDialog({ work, onClose }: { work: Work | null; onClose: () => void }) {
  if (!work) return null;
  return <Dialog key={work.id} work={work} onClose={onClose} />;
}

function Dialog({ work, onClose }: { work: Work; onClose: () => void }) {
  const profile = useProfile();
  const [title, setTitle] = useState(work.title);
  const [logline, setLogline] = useState(work.logline);
  const [rating, setRating] = useState<Rating>(work.rating);
  const [heat, setHeat] = useState(work.heat);
  const [fandom, setFandom] = useState(work.fandom ?? "");
  const [ships, setShips] = useState(work.ships);
  const [tags, setTags] = useState(work.tags);
  const [warnings, setWarnings] = useState(work.warnings.filter((w) => w !== "Underage (none)"));
  const [wordGoal, setWordGoal] = useState(work.wordGoal ? String(work.wordGoal) : "");
  const [gate, setGate] = useState(false);
  const craft = craftOf(work.craft);
  const adultRating = rating === "mature" || rating === "explicit";

  async function save(confirmedAdult = false) {
    if (adultRating && !profile.adultVerified && !confirmedAdult) {
      setGate(true);
      return;
    }
    await updateWork(work.id, {
      title: title.trim() || work.title,
      logline: logline.trim(),
      rating,
      heat: adultRating ? heat : 0,
      fandom: fandom.trim() || undefined,
      ships,
      tags,
      warnings: warnings.filter((w) => w !== "Underage (none)"),
      wordGoal: wordGoal ? Math.max(0, Number(wordGoal) || 0) || undefined : undefined,
    });
    toast("Saved", `${title.trim() || work.title} · ${RATING_META[rating].label}`, "success");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-deep/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="sf-enter max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[18px] border border-line bg-surface p-5 shadow-2xl sm:rounded-[16px] sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium">Work settings</h2>
            <p className="mt-1 text-sm text-ink-2">{craft.label}. The companion reads all of this before it writes.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Logline">
            <Textarea rows={2} value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="One sentence that tells you what this is." />
          </Field>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Rating</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(RATING_META) as Rating[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  className={`rounded-[10px] border px-3 py-2 text-left transition-colors ${rating === r ? "border-gold bg-gold/10" : "border-line hover:border-line-2"}`}
                >
                  <div className="text-sm font-medium">{RATING_META[r].label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{RATING_META[r].blurb}</div>
                </button>
              ))}
            </div>
            {adultRating && !profile.adultVerified && (
              <p className="mt-2 text-xs text-gold">You will be asked to confirm you are an adult when you save.</p>
            )}
          </div>

          {adultRating && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-2">
                Heat: {HEAT_LABELS[heat]} ({heat}/5)
              </span>
              <input type="range" min={0} max={5} value={heat} onChange={(e) => setHeat(Number(e.target.value))} className="w-full accent-[var(--gold)]" />
              <p className="mt-1 text-[11px] text-ink-3">How far intimate scenes go on the page. The companion never goes past this, and you can turn it up or down per passage.</p>
            </div>
          )}

          {(work.craft === "fanfic" || fandom) && (
            <Field label="Fandom" hint="Franchise, series, game or book world. The companion uses its knowledge of the canon.">
              <Input value={fandom} onChange={(e) => setFandom(e.target.value)} placeholder="e.g. Star Wars, The Witcher, BTS, Naruto, Bridgerton" />
            </Field>
          )}
          {work.craft !== "fanfic" && !fandom && (
            <button type="button" onClick={() => setFandom(" ")} className="text-left text-xs text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-ink">
              Set in an existing fandom?
            </button>
          )}

          <Field label="Relationships" hint="A/B for romantic, A & B for platonic.">
            <TagInput value={ships} onChange={setShips} placeholder="Add a ship and press Enter" />
          </Field>
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} placeholder="Tropes, settings, moods" suggestions={COMMON_TAGS} />
          </Field>
          <Field label="Content warnings" hint="What a reader should know going in.">
            <TagInput value={warnings} onChange={setWarnings} placeholder="Optional" suggestions={COMMON_WARNINGS.filter((w) => w !== "Underage (none)")} />
          </Field>
          <Field label="Word goal (optional)">
            <Input type="number" inputMode="numeric" value={wordGoal} onChange={(e) => setWordGoal(e.target.value)} placeholder="80000" />
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="gold" onClick={() => void save()}>
            Save settings
          </Button>
        </div>
      </div>
      <AdultGate open={gate} onClose={() => setGate(false)} onConfirmed={() => void save(true)} />
    </div>
  );
}
