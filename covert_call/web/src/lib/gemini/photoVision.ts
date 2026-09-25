import { GoogleGenAI } from '@google/genai'

// Gemini vision analysis of a photo attached on the silent tap-only screen (Epic 6.1). A person with no way to
// talk can attach a picture of their situation; Gemini turns it into structured signal for a responder. Runs
// client-side with the same key/pattern as the other Gemini text passes — no backend needed.
const MODEL = 'gemini-3.5-flash-lite'

export interface PhotoAnalysis {
  dangerIndicators: string[]
  observations: string[]
  urgency: 'low' | 'medium' | 'high'
  summary: string
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    dangerIndicators: { type: 'array', items: { type: 'string' } },
    observations: { type: 'array', items: { type: 'string' } },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
  },
  required: ['dangerIndicators', 'observations', 'urgency', 'summary'],
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Analyses one attached image into structured incident signal. Throws if Gemini isn't configured.
export async function analyzePhoto(file: Blob): Promise<PhotoAnalysis> {
  const apiKey = import.meta.env.VITE_GEMINI_LIVE_API_KEY
  if (!apiKey) throw new Error('Gemini is not configured')
  const client = new GoogleGenAI({ apiKey })
  const base64 = await fileToBase64(file)

  const prompt = `You are assisting an emergency responder. A person who cannot speak has attached this photo to a
silent help request. Describe only what is actually visible — do not invent. Extract:
- dangerIndicators: short responder tags for anything hazardous visible (e.g. "weapon: knife", "person injured -
  bleeding", "fire/smoke", "forced entry", "multiple people"). Empty if nothing dangerous is visible.
- observations: neutral short notes of what's in the frame (people, place, objects, vehicle, signage/location clues).
- urgency: low / medium / high based on visible danger.
- summary: one or two sentences a dispatcher can read at a glance.`

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/jpeg', data: base64 } }] }],
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as PhotoAnalysis
}
