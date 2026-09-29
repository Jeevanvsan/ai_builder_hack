import { GoogleGenAI } from '@google/genai'
import { GEMINI_API_KEY } from '../config'

// Native port of web/src/lib/gemini/photoVision.ts — keep the prompt and schema in sync.
//
// Two differences from the web version, both mechanical:
//   1. The key comes from config.ts (EXPO_PUBLIC_*) rather than import.meta.env.
//   2. It takes base64 + a mime type instead of a Blob. expo-image-picker hands back base64 directly, so there's
//      no FileReader step to port.
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

// Analyses one attached image into structured incident signal. Throws if Gemini isn't configured.
export async function analyzePhoto(photo: { base64: string; mimeType: string }): Promise<PhotoAnalysis> {
  if (!GEMINI_API_KEY) throw new Error('Gemini is not configured')
  const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

  const prompt = `You are assisting an emergency responder. A person who cannot speak has attached this photo to a
silent help request. Describe only what is actually visible — do not invent. Extract:
- dangerIndicators: short responder tags for anything hazardous visible (e.g. "weapon: knife", "person injured -
  bleeding", "fire/smoke", "forced entry", "multiple people"). Empty if nothing dangerous is visible.
- observations: neutral short notes of what's in the frame (people, place, objects, vehicle, signage/location clues).
- urgency: low / medium / high based on visible danger.
- summary: one or two sentences a dispatcher can read at a glance.`

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: photo.mimeType || 'image/jpeg', data: photo.base64 } }] },
    ],
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as PhotoAnalysis
}
