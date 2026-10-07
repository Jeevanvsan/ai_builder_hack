import { AI_MODELS } from '../../../../shared/aiModels'
import { geminiKeys, generateWithFallback } from './keys'
import { GoogleGenAI } from '@google/genai'
import { GROUNDED_CONTEXT_ENABLED } from '../config'

// Native port of web/src/lib/gemini/groundedContext.ts — keep in sync.
//
// Gemini's Search grounding, narrowly scoped to non-personal, factual context: weather/road conditions near a
// confirmed location. Never pass a person's name into this; only ever a location string, so it can't be
// repurposed as a people-search tool.
//
// Off by default (see config.ts): every ended call already makes 1-2 requests to this same shared free-tier
// model quota, and this is the least essential of the post-call passes.
const MODEL = AI_MODELS.groundedContext // shared/aiModels.ts

export async function groundedLocationContext(address: string): Promise<string | null> {
  if (!GROUNDED_CONTEXT_ENABLED) return null
  if (!geminiKeys.configured) return null

  try {
    const response = await generateWithFallback({
      model: MODEL,
      contents: `One short factual sentence (max 20 words) about current weather or road conditions near this location, for an emergency responder's context: ${address}. If nothing relevant is found, reply with exactly "none".`,
      config: { tools: [{ googleSearch: {} }] },
    })
    const text = response.text?.trim()
    if (!text || /^none\.?$/i.test(text)) return null
    return text
  } catch {
    return null // Best-effort context only — never blocks consolidation if grounding fails.
  }
}
