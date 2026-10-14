"use client";

import { useCallback, useRef, useState } from "react";
import type { AiStreamRequest } from "@/lib/types";

/**
 * Streams plain text from /api/ai/stream. Kept deliberately small:
 * one fetch, one reader, one abort controller.
 */
export function useCompanionStream() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    setBusy(false);
  }, []);

  const run = useCallback(async (req: AiStreamRequest): Promise<string> => {
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    setText("");
    setError(null);
    setBusy(true);
    let acc = "";
    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text().catch(() => "")) || `The companion answered with ${res.status}.`;
        throw new Error(msg);
      }
      setModel(res.headers.get("X-StoryForge-Model"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      acc += decoder.decode();
      setText(acc);
      return acc;
    } catch (err) {
      if ((err as Error).name === "AbortError") return acc;
      const msg = (err as Error).message || "The companion is unavailable.";
      setError(msg);
      throw err;
    } finally {
      if (ctrl.current === ac) {
        ctrl.current = null;
        setBusy(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    setText("");
    setError(null);
  }, []);

  return { text, busy, error, model, run, stop, reset };
}

export async function companionJson<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch("/api/ai/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({ error: `The companion answered with ${res.status}.` }));
  if (!res.ok) throw new Error(data?.error ?? `The companion answered with ${res.status}.`);
  return data as T;
}
