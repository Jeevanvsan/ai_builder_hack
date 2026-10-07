// Scene start/end in seconds. The background clip (public/intro-bg.mp4, 20 s) carries the whole problem story, so
// hook + problem + legacy fit inside its first 20 s and QuickBite is revealed the moment it ends. Line the rest up
// with the ElevenLabs voiceover: play it in Remotion Studio and move each scene's start to where its sentence begins.
export const FPS = 30

export const SCENES = {
  hook: { from: 0, to: 11 }, // the clip's own story (0-11 s): "Ten at night… Someone is inside."
  problem: { from: 11, to: 15.5 }, // the clip's problem line starts at 11 s
  legacy: { from: 15.5, to: 20 }, // "Legacy systems fail them… responders arrive blind."
  reveal: { from: 20, to: 23 }, // "So we built QuickBite."
  app: { from: 23, to: 40 }, // "It looks like a food delivery app… under three minutes."
  dashboard: { from: 40, to: 50 }, // "The responder dashboard shows it all live…"
  close: { from: 50, to: 57.5 }, // "QuickBite. A food order outside. A lifeline inside."
} as const

// The hook/problem/legacy animations were designed for these lengths (seconds); they are time-stretched to fit the
// spans above, so every beat keeps its order and spacing.
export const DESIGNED = { hook: 8.5, problem: 11, legacy: 12 } as const
export const stretch = (k: keyof typeof DESIGNED) => DESIGNED[k] / (SCENES[k].to - SCENES[k].from)

export const TOTAL_SECONDS = SCENES.close.to
export const sec = (s: number) => Math.round(s * FPS)
export const span = (k: keyof typeof SCENES) => ({ from: sec(SCENES[k].from), durationInFrames: sec(SCENES[k].to - SCENES[k].from) })

// Voiceover: the first VOICE_TRIM_SECONDS of public/voiceover.mp3 are cut, and the rest plays from VOICE_START
// (right after the clip, which carries its own sound for the first 20 s).
export const VOICE_TRIM_SECONDS = 37
export const VOICE_START = SCENES.reveal.from
