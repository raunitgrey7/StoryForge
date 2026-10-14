"use client";

import { create } from "zustand";
import { DEFAULT_VOICE, VOICE_IDS, type VoiceId } from "./voices";

/**
 * Read-aloud. Two engines:
 *  - neural: Gemini's speech models through /api/ai/speak, one paragraph per
 *    request, the next paragraph prefetched while the current one plays.
 *    Soft British by default.
 *  - device: the browser's own speechSynthesis voices, free and offline,
 *    used as the fallback when the neural voice is unavailable.
 * Text is spoken paragraph by paragraph so the reader can see where it is.
 */

export type Engine = "neural" | "device";

interface TtsState {
  supported: boolean;
  engine: Engine;
  neuralVoice: VoiceId;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  rate: number;
  playing: boolean;
  paused: boolean;
  loading: boolean;
  index: number; // paragraph being read
  total: number;
  error: string | null;
  setEngine: (e: Engine) => void;
  setNeuralVoice: (v: VoiceId) => void;
  setVoice: (uri: string | null) => void;
  setRate: (r: number) => void;
}

function saved<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const useTts = create<TtsState>((set) => ({
  supported: typeof window !== "undefined",
  engine: typeof window !== "undefined" ? saved<Engine>("sf:tts:engine", "neural") : "neural",
  neuralVoice: typeof window !== "undefined" && VOICE_IDS.includes(saved<VoiceId>("sf:tts:neural", DEFAULT_VOICE)) ? saved<VoiceId>("sf:tts:neural", DEFAULT_VOICE) : DEFAULT_VOICE,
  voices: [],
  voiceURI: null,
  rate: typeof window !== "undefined" ? saved<number>("sf:tts:rate2", 1) : 1,
  playing: false,
  paused: false,
  loading: false,
  index: -1,
  total: 0,
  error: null,
  setEngine: (engine) => {
    save("sf:tts:engine", engine);
    set({ engine });
  },
  setNeuralVoice: (neuralVoice) => {
    save("sf:tts:neural", neuralVoice);
    set({ neuralVoice });
  },
  setVoice: (voiceURI) => {
    if (voiceURI) save("sf:tts:voice", voiceURI);
    set({ voiceURI });
  },
  setRate: (rate) => {
    save("sf:tts:rate2", rate);
    set({ rate });
    if (audio) audio.playbackRate = rate;
  },
}));

let paragraphs: string[] = [];
let onParagraph: ((i: number) => void) | null = null;
let session = 0; // increments on every start/stop so stale callbacks are ignored
let audio: HTMLAudioElement | null = null;
const clipCache = new Map<string, Promise<string>>(); // key -> object URL

/* ---------------- device voices ---------------- */

function loadVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return;
  const english = all.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const voices = (english.length ? english : all).sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
  const savedUri = saved<string | null>("sf:tts:voice", null);
  const pick =
    voices.find((v) => v.voiceURI === savedUri) ??
    voices.find((v) => /en-GB/i.test(v.lang) && /female|libby|sonia|hazel|susan|kate/i.test(v.name)) ??
    voices.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ??
    voices[0];
  useTts.setState({ voices, voiceURI: pick?.voiceURI ?? null });
}

export function initTts() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speakDeviceFrom(i: number, mySession: number) {
  const synth = window.speechSynthesis;
  if (mySession !== session || i >= paragraphs.length) {
    if (mySession === session) useTts.setState({ playing: false, paused: false, index: -1 });
    return;
  }
  const { voices, voiceURI, rate } = useTts.getState();
  const u = new SpeechSynthesisUtterance(paragraphs[i]);
  const v = voices.find((x) => x.voiceURI === voiceURI);
  if (v) u.voice = v;
  u.rate = rate;
  u.onstart = () => {
    if (mySession !== session) return;
    useTts.setState({ index: i });
    onParagraph?.(i);
  };
  u.onend = () => {
    if (mySession === session) speakDeviceFrom(i + 1, mySession);
  };
  u.onerror = (e) => {
    if (e.error === "interrupted" || e.error === "canceled") return;
    if (mySession === session) useTts.setState({ playing: false, paused: false, index: -1 });
  };
  synth.speak(u);
}

/* ---------------- neural voice ---------------- */

function clipKey(text: string, voice: VoiceId) {
  return `${voice}:${text}`;
}

function fetchClip(text: string, voice: VoiceId): Promise<string> {
  const key = clipKey(text, voice);
  const hit = clipCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch("/api/ai/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 1800), voice }) });
    if (!res.ok) throw new Error((await res.text().catch(() => "")) || `The voice answered with ${res.status}.`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  })();
  p.catch(() => clipCache.delete(key));
  clipCache.set(key, p);
  if (clipCache.size > 60) {
    const first = clipCache.keys().next().value;
    if (first) clipCache.delete(first);
  }
  return p;
}

async function speakNeuralFrom(i: number, mySession: number) {
  if (mySession !== session || i >= paragraphs.length) {
    if (mySession === session) useTts.setState({ playing: false, paused: false, loading: false, index: -1 });
    return;
  }
  const { neuralVoice, rate } = useTts.getState();
  useTts.setState({ loading: true, index: i });
  onParagraph?.(i);
  // Prefetch the next paragraph while this one is fetched and played.
  if (i + 1 < paragraphs.length) fetchClip(paragraphs[i + 1], neuralVoice).catch(() => {});
  let url: string;
  try {
    url = await fetchClip(paragraphs[i], neuralVoice);
  } catch (err) {
    if (mySession !== session) return;
    // Fall back to the device voice for the rest of this reading.
    useTts.setState({ engine: "device", loading: false, error: (err as Error).message });
    speakDeviceFrom(i, mySession);
    return;
  }
  if (mySession !== session) return;
  useTts.setState({ loading: false });
  audio = new Audio(url);
  audio.playbackRate = rate;
  audio.onended = () => {
    if (mySession === session) speakNeuralFrom(i + 1, mySession);
  };
  audio.onerror = () => {
    if (mySession === session) speakNeuralFrom(i + 1, mySession);
  };
  try {
    await audio.play();
  } catch {
    if (mySession === session) useTts.setState({ playing: false, paused: false, index: -1, error: "Tap play again; the browser blocked autoplay." });
  }
}

/* ---------------- public controls ---------------- */

/** Start reading a list of paragraphs from an index. */
export function speak(paras: string[], from = 0, cb?: (i: number) => void) {
  stop();
  paragraphs = paras.filter((p) => p.trim());
  onParagraph = cb ?? null;
  session++;
  const mySession = session;
  useTts.setState({ playing: true, paused: false, total: paragraphs.length, index: from, error: null });
  if (useTts.getState().engine === "neural") void speakNeuralFrom(from, mySession);
  else speakDeviceFrom(from, mySession);
}

export function pause() {
  if (useTts.getState().engine === "neural") audio?.pause();
  else if ("speechSynthesis" in window) window.speechSynthesis.pause();
  useTts.setState({ paused: true });
}

export function resume() {
  if (useTts.getState().engine === "neural") void audio?.play();
  else if ("speechSynthesis" in window) window.speechSynthesis.resume();
  useTts.setState({ paused: false });
}

export function stop() {
  session++;
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  useTts.setState({ playing: false, paused: false, loading: false, index: -1 });
}

export function skip(delta: number) {
  const { index } = useTts.getState();
  const next = Math.max(0, Math.min(paragraphs.length - 1, index + delta));
  const cb = onParagraph ?? undefined;
  speak(paragraphs, next, cb);
}

/** Warm the cache for the first paragraphs so play starts instantly. */
export function prefetch(paras: string[], count = 2) {
  const { engine, neuralVoice } = useTts.getState();
  if (engine !== "neural") return;
  paras
    .filter((p) => p.trim())
    .slice(0, count)
    .forEach((p) => fetchClip(p, neuralVoice).catch(() => {}));
}
