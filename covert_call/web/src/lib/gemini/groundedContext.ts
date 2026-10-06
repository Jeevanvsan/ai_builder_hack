import { AI_MODELS } from '../../../../shared/aiModels.ts'
import { AI_FEATURES } from '../../../../shared/aiFeatures.ts'
import { geminiConfigured, generateText } from './aiLogic.ts'

// Epic 16.10: Gemini's Search grounding tool, narrowly scoped to non-personal, factual context — weather/road
// conditions near a confirmed location. Never pass a person's name into this; only ever a location string, so it
// can't be repurposed as a people-search tool (see the extended feature brainstorm's explicit rejection of any
// "search a named person" feature). This is a nice-to-have context line, not a core capability.
const MODEL = AI_MODELS.groundedContext // shared/aiModels.ts

// Off by default: every ended call already makes 1-2 requests to this same shared free-tier model quota
// (consolidation, correlation) — this weather/road line is the least essential of the post-call passes, so it's
// skipped unless explicitly turned on, rather than adding a 3rd request to every single call.
// Paused for the prototype (shared/aiFeatures.ts); the env flag alone no longer turns it on.
const ENABLED = AI_FEATURES.groundedContext && import.meta.env.VITE_ENABLE_GROUNDED_CONTEXT === 'true'

export async function groundedLocationContext(address: string): Promise<string | null> {
  if (!ENABLED) return null
  if (!geminiConfigured) return null

  try {
    const response = await generateText({
      model: MODEL,
      task: 'groundedContext',
      contents: `One short factual sentence (max 20 words) about current weather or road conditions near this location, for an emergency responder's context: ${address}. If nothing relevant is found, reply with exactly "none".`,
      config: { tools: [{ googleSearch: {} }] },
    })
    const text = response.text?.trim()
    if (!text || /^none\.?$/i.test(text)) return null
    return text
  } catch {
    return null // Best-effort context only — never blocks consolidation if grounding fails or isn't available.
  }
}
