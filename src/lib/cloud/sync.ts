"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { db, getProfile, getSetting, PROFILE_KEY, setSetting } from "@/lib/db";
import type { Doc, Entity, Profile, Snapshot, Sprint, Tombstone, Work } from "@/lib/types";
import { supabase } from "./supabase";

/**
 * Cloud sync: the local IndexedDB stays the working store; every row is
 * mirrored to Supabase as {id, user_id, data, updated_at}. Newer wins.
 * Deletions travel as tombstones. Runs on sign-in, on an interval, when the
 * tab is hidden, and on demand.
 */

type Table = "works" | "docs" | "entities" | "snapshots" | "sprints" | "illustrations";
// Illustrations stay on the device for now: they are large data URLs.
const TABLES: Table[] = ["works", "docs", "entities", "snapshots", "sprints"];
const LAST_KEY = "sf:cloud:lastSync";
const SKEW = 90_000; // clocks differ; overlap the window, upserts are idempotent

interface SyncState {
  user: User | null;
  ready: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
}

export const useCloud = create<SyncState>(() => ({ user: null, ready: false, syncing: false, lastSyncedAt: null, error: null }));

let started = false;
let timer: number | null = null;
let inflight: Promise<void> | null = null;

function stamp(t: Table, row: Record<string, unknown>): number {
  if (t === "snapshots") return Number(row.createdAt ?? 0);
  if (t === "sprints") return Number(row.endedAt ?? row.startedAt ?? 0);
  return Number(row.updatedAt ?? 0);
}

export function startCloud() {
  if (started) return;
  started = true;
  const sb = supabase();
  if (!sb) {
    useCloud.setState({ ready: true });
    return;
  }
  sb.auth.getSession().then(({ data }) => {
    useCloud.setState({ user: data.session?.user ?? null, ready: true });
    if (data.session) void syncNow();
  });
  sb.auth.onAuthStateChange((_evt, session: Session | null) => {
    const prev = useCloud.getState().user?.id;
    useCloud.setState({ user: session?.user ?? null, ready: true });
    if (session && session.user.id !== prev) void syncNow();
  });
  timer = window.setInterval(() => void syncNow(), 45_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void syncNow();
  });
  window.addEventListener("beforeunload", () => void syncNow());
}

export function stopCloud() {
  if (timer) window.clearInterval(timer);
  started = false;
}

export async function signInWithGoogle() {
  const sb = supabase();
  if (!sb) throw new Error("Cloud is not configured.");
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/studio` } });
  if (error) throw error;
}

export async function signInWithEmail(email: string) {
  const sb = supabase();
  if (!sb) throw new Error("Cloud is not configured.");
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/studio` } });
  if (error) throw error;
}

export async function signOut() {
  const sb = supabase();
  if (!sb) return;
  await syncNow();
  await sb.auth.signOut();
  useCloud.setState({ user: null });
}

export function syncNow(): Promise<void> {
  if (inflight) return inflight;
  inflight = run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run() {
  const sb = supabase();
  const user = useCloud.getState().user;
  if (!sb || !user) return;
  useCloud.setState({ syncing: true, error: null });
  try {
    const last = await getSetting<number>(LAST_KEY, 0);
    const since = Math.max(0, last - SKEW);
    const startedAt = Date.now();

    // ---- pull -------------------------------------------------------------
    for (const t of TABLES) {
      const { data, error } = await sb.from(t).select("id, data, updated_at").eq("user_id", user.id).gt("updated_at", since).limit(5000);
      if (error) throw new Error(`${t}: ${error.message}`);
      if (!data?.length) continue;
      const table = db.table(t);
      const ids = data.map((r) => r.id as string);
      const local = new Map((await table.bulkGet(ids)).filter(Boolean).map((r) => [(r as { id: string }).id, r as Record<string, unknown>]));
      const puts: Record<string, unknown>[] = [];
      for (const r of data) {
        const remote = r.data as Record<string, unknown>;
        const mine = local.get(r.id as string);
        if (!mine || stamp(t, mine) < stamp(t, remote)) puts.push(remote);
      }
      if (puts.length) await table.bulkPut(puts);
    }
    {
      const { data, error } = await sb.from("tombstones").select("id, data").eq("user_id", user.id).gt("updated_at", since).limit(5000);
      if (error) throw new Error(`tombstones: ${error.message}`);
      for (const r of data ?? []) {
        const ts = r.data as Tombstone;
        const table = db.table(ts.table);
        const row = (await table.get(ts.id)) as Record<string, unknown> | undefined;
        if (row && stamp(ts.table, row) <= ts.deletedAt) await table.delete(ts.id);
        await db.tombstones.put(ts);
      }
    }
    {
      const { data, error } = await sb.from("profiles").select("data, updated_at").eq("user_id", user.id).maybeSingle();
      if (error) throw new Error(`profile: ${error.message}`);
      const remote = data?.data as Profile | undefined;
      const mine = await getProfile();
      if (remote && remote.updatedAt > mine.updatedAt) await setSetting(PROFILE_KEY, remote);
    }

    // ---- push -------------------------------------------------------------
    for (const t of TABLES) {
      const rows = (await db.table(t).toArray()) as Record<string, unknown>[];
      const changed = rows.filter((r) => stamp(t, r) > since);
      for (let i = 0; i < changed.length; i += 200) {
        const batch = changed.slice(i, i + 200).map((r) => ({ id: r.id as string, user_id: user.id, data: r, updated_at: stamp(t, r) }));
        const { error } = await sb.from(t).upsert(batch, { onConflict: "id" });
        if (error) throw new Error(`${t}: ${error.message}`);
      }
    }
    {
      const stones = await db.tombstones.where("deletedAt").above(since).toArray();
      for (let i = 0; i < stones.length; i += 200) {
        const batch = stones.slice(i, i + 200).map((s) => ({ id: `${s.table}:${s.id}`, user_id: user.id, data: s, updated_at: s.deletedAt }));
        const { error } = await sb.from("tombstones").upsert(batch, { onConflict: "id" });
        if (error) throw new Error(`tombstones: ${error.message}`);
      }
    }
    {
      const mine = await getProfile();
      if (mine.updatedAt > since) {
        const { error } = await sb.from("profiles").upsert({ user_id: user.id, data: mine, updated_at: mine.updatedAt }, { onConflict: "user_id" });
        if (error) throw new Error(`profile: ${error.message}`);
      }
    }

    await setSetting(LAST_KEY, startedAt);
    useCloud.setState({ lastSyncedAt: Date.now(), syncing: false });
  } catch (err) {
    useCloud.setState({ syncing: false, error: (err as Error).message });
  }
}

export type { Work, Doc, Entity, Snapshot, Sprint };
