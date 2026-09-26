import { GoogleGenAI } from '@google/genai'

// Epic 16.10: Gemini's Search grounding tool, narrowly scoped to non-personal, factual context — weather/road
// conditions near a confirmed location. Never pass a person's name into this; only ever a location string, so it
// can't be repurposed as a people-search tool (see the extended feature brainstorm's explicit rejection of any
// "search a named person" feature). This is a nice-to-have context line, not a core capability.
const MODEL = 'gemini-3.5-flash-lite'

export async function groundedLocationContext(address: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_LIVE_API_KEY
  if (!apiKey) return null

  try {
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: MODEL,
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
