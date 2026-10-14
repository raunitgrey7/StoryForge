/** Neural voices for read-aloud, spoken by Gemini's speech models. Shared by the route and the player. */
export const VOICES = {
  "soft-british": {
    label: "Soft British (she)",
    voice: "Aoede",
    style:
      "Read this softly and warmly in a gentle British accent (received pronunciation), unhurried and intimate, like reading aloud to one person at night. Do not announce anything, do not add words; just read the text:",
  },
  "bright-british": {
    label: "Bright British (she)",
    voice: "Leda",
    style: "Read this in a clear, bright British accent (received pronunciation), light and engaging, with natural pacing. Do not announce anything, do not add words; just read the text:",
  },
  "warm-american": {
    label: "Warm American (she)",
    voice: "Kore",
    style: "Read this in a warm, calm American voice, natural and unhurried. Do not announce anything, do not add words; just read the text:",
  },
  "low-british": {
    label: "Low British (he)",
    voice: "Charon",
    style: "Read this in a low, calm male British voice (received pronunciation), measured and warm. Do not announce anything, do not add words; just read the text:",
  },
  storyteller: {
    label: "Storyteller (he)",
    voice: "Fenrir",
    style: "Read this in a rich, expressive male storyteller's voice, with gravity and warmth. Do not announce anything, do not add words; just read the text:",
  },
} as const;

export type VoiceId = keyof typeof VOICES;
export const VOICE_IDS = Object.keys(VOICES) as VoiceId[];
export const DEFAULT_VOICE: VoiceId = "soft-british";
