// Scene start/end in seconds. Line these up with the ElevenLabs voiceover: play it in Remotion Studio and move each
// scene's start to where its sentence begins. Everything else is derived from this table.
export const FPS = 30

export const SCENES = {
  hook: { from: 0, to: 8.5 }, // "Ten at night… Someone is inside."
  problem: { from: 8.5, to: 19.5 }, // "This is the problem… when it matters most."
  legacy: { from: 19.5, to: 31.5 }, // "Legacy systems fail them… responders arrive blind."
  reveal: { from: 31.5, to: 34.5 }, // "So we built QuickBite."
  app: { from: 34.5, to: 48 }, // "It looks like a food delivery app… under three minutes."
  dashboard: { from: 48, to: 55 }, // "The responder dashboard shows it all live…"
  close: { from: 55, to: 60 }, // "QuickBite. A food order outside. A lifeline inside."
} as const

export const TOTAL_SECONDS = SCENES.close.to
export const sec = (s: number) => Math.round(s * FPS)
export const span = (k: keyof typeof SCENES) => ({ from: sec(SCENES[k].from), durationInFrames: sec(SCENES[k].to - SCENES[k].from) })
