"use client";

import { useEffect } from "react";
import { Pause, Play, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";
import { initTts, pause, prefetch, resume, skip, speak, stop, useTts } from "@/lib/tts";
import { VOICE_IDS, VOICES } from "@/lib/voices";
import { Spinner } from "@/components/ui/primitives";

/**
 * Read-aloud controls. `paragraphs` is the text to read; `onParagraph`
 * lets the host highlight the paragraph being spoken. Default voice is a
 * soft British neural voice; device voices are the fallback.
 */
export function Listen({
  paragraphs,
  onParagraph,
  compact = false,
  light = false,
}: {
  paragraphs: string[];
  onParagraph?: (i: number) => void;
  compact?: boolean;
  light?: boolean;
}) {
  const t = useTts();

  useEffect(() => {
    initTts();
    return () => stop();
  }, []);

  if (!t.supported) return null;

  const ink = light ? "text-[#4b4570]" : "text-ink-2";
  const hover = light ? "hover:bg-[#f0ecf9]" : "hover:bg-surface-2";
  const btn = `inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${ink} ${hover}`;
  const select = `h-8 rounded-md border-0 bg-transparent text-xs ${ink}`;

  if (!t.playing) {
    return (
      <button
        onClick={() => speak(paragraphs, 0, onParagraph)}
        onMouseEnter={() => prefetch(paragraphs)}
        disabled={paragraphs.length === 0}
        data-tip={`Read this aloud. Voice: ${t.engine === "neural" ? VOICES[t.neuralVoice].label : "device"}. Change it once playing.`}
        data-tip-side="bottom"
        data-tip-align="end"
        className={`${btn} disabled:opacity-40`}
        aria-label="Listen"
      >
        <Volume2 size={18} />
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-0.5 rounded-[12px] ${light ? "bg-[#f0ecf9]" : "bg-surface-2"} px-1`}>
      <button onClick={() => skip(-1)} className={btn} aria-label="Previous paragraph" data-tip="Back one paragraph" data-tip-side="bottom">
        <SkipBack size={15} />
      </button>
      {t.loading ? (
        <span className={btn} aria-label="Loading voice">
          <Spinner />
        </span>
      ) : t.paused ? (
        <button onClick={resume} className={btn} aria-label="Resume" data-tip="Resume" data-tip-side="bottom">
          <Play size={16} />
        </button>
      ) : (
        <button onClick={pause} className={btn} aria-label="Pause" data-tip="Pause" data-tip-side="bottom">
          <Pause size={16} />
        </button>
      )}
      <button onClick={() => skip(1)} className={btn} aria-label="Next paragraph" data-tip="Forward one paragraph" data-tip-side="bottom">
        <SkipForward size={15} />
      </button>
      <button onClick={stop} className={btn} aria-label="Stop" data-tip="Stop reading" data-tip-side="bottom">
        <Square size={14} />
      </button>
      {!compact && (
        <>
          <select
            value={t.engine === "neural" ? t.neuralVoice : `device:${t.voiceURI ?? ""}`}
            onChange={(e) => {
              const v = e.target.value;
              const { index } = useTts.getState();
              if (v.startsWith("device:")) {
                t.setEngine("device");
                t.setVoice(v.slice(7) || null);
              } else {
                t.setEngine("neural");
                t.setNeuralVoice(v as (typeof VOICE_IDS)[number]);
              }
              speak(paragraphs, Math.max(0, index), onParagraph);
            }}
            className={`ml-1 max-w-[170px] ${select}`}
            aria-label="Voice"
            data-tip="Neural voices are read by Gemini; device voices are your browser's own."
            data-tip-side="bottom"
          >
            <optgroup label="Neural">
              {VOICE_IDS.map((id) => (
                <option key={id} value={id}>
                  {VOICES[id].label}
                </option>
              ))}
            </optgroup>
            {t.voices.length > 0 && (
              <optgroup label="Device">
                {t.voices.map((v) => (
                  <option key={v.voiceURI} value={`device:${v.voiceURI}`}>
                    {v.name.replace(/^Microsoft |^Google /, "")}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <select value={t.rate} onChange={(e) => t.setRate(Number(e.target.value))} className={select} aria-label="Speed">
            {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </>
      )}
      <span className={`px-1.5 text-[11px] tabular-nums ${ink}`}>
        {t.index + 1}/{t.total}
      </span>
      {t.error && <span className="px-1.5 text-[11px] text-ember">{t.error}</span>}
    </div>
  );
}
