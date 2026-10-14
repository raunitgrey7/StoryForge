"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, PROFILE_KEY } from "@/lib/db";
import { EMPTY_TASTES, type Profile } from "@/lib/types";

const FALLBACK: Profile = { displayName: "", adultVerified: false, tastes: EMPTY_TASTES, updatedAt: 0 };

/** Live profile: who is writing and what they like. */
export function useProfile(): Profile {
  const row = useLiveQuery(() => db.settings.get(PROFILE_KEY), []);
  const p = (row?.value as Partial<Profile> | undefined) ?? undefined;
  if (!p) return FALLBACK;
  return {
    displayName: p.displayName ?? "",
    adultVerified: p.adultVerified ?? false,
    adultVerifiedAt: p.adultVerifiedAt,
    tastes: { ...EMPTY_TASTES, ...(p.tastes ?? {}) },
    updatedAt: p.updatedAt ?? 0,
  };
}
