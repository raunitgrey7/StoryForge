"use client";

import { useMemo } from "react";
import { useStudioData } from "./useStudioData";
import { useProfile } from "./useProfile";
import { buildVoiceCard } from "@/lib/voice";
import type { AiStreamRequest, WorkContext } from "@/lib/types";

/**
 * Everything the companion needs to know about where the writer is:
 * the work, the current piece, the voice card, the bible, the rating and
 * the writer's tastes.
 */
export function useCompanionContext() {
  const { work, doc, docs, entities, craft } = useStudioData();
  const profile = useProfile();

  const voice = useMemo(() => {
    const texts = docs.map((d) => d.text).filter(Boolean);
    return buildVoiceCard(texts);
  }, [docs]);

  const bible = useMemo(
    () =>
      entities
        .slice()
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.mentions - a.mentions)
        .slice(0, 40)
        .map((e) => ({ kind: e.kind, name: e.name, description: e.description })),
    [entities],
  );

  const previousSummary = useMemo(() => {
    if (!doc) return "";
    const before = docs.filter((d) => !d.parentId && d.order < doc.order && d.id !== doc.id).sort((a, b) => a.order - b.order);
    if (before.length === 0) return "";
    return before.map((d) => `${d.title}: ${d.text.slice(0, 400).replace(/\s+/g, " ")}…`).join(" | ").slice(0, 3000);
  }, [docs, doc]);

  const workContext: WorkContext = useMemo(
    () => ({
      rating: work?.rating ?? "everyone",
      heat: work?.heat ?? 0,
      fandom: work?.fandom,
      ships: work?.ships ?? [],
      tags: work?.tags ?? [],
      warnings: work?.warnings ?? [],
      adult: profile.adultVerified,
    }),
    [work, profile.adultVerified],
  );

  /** True when the work's rating needs an adult confirmation the writer has not given. */
  const needsAdultGate = (work?.rating === "mature" || work?.rating === "explicit") && !profile.adultVerified;

  function base(partial: Partial<AiStreamRequest> & Pick<AiStreamRequest, "task">): AiStreamRequest {
    return {
      craft: craft.id,
      workTitle: work?.title ?? "Untitled",
      logline: work?.logline,
      docTitle: doc?.title ?? "Untitled",
      text: doc?.text ?? "",
      voice,
      bible,
      previousSummary,
      tastes: profile.tastes,
      ...workContext,
      ...partial,
    };
  }

  return { work, doc, docs, entities, craft, voice, bible, previousSummary, profile, workContext, needsAdultGate, base };
}
