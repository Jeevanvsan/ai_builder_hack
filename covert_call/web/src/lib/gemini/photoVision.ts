import { AI_MODELS } from '../../../../shared/aiModels.ts'
import { geminiConfigured, generateText } from './aiLogic.ts'

// Gemini vision analysis of a photo attached on the silent tap-only screen (Epic 6.1). A person with no way to
// talk can attach a picture of their situation; Gemini turns it into structured signal for a responder. Runs
// client-side with the same key/pattern as the other Gemini text passes — no backend needed.
const MODEL = AI_MODELS.photoVision // shared/aiModels.ts

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
// Phone photos are 3-12 MP; image tokens scale with size, and recognising a weapon, an injury or a plate needs far
// less. Downscale to 1024 px on the long side as JPEG before sending (falls back to the original if it can't).
const MAX_SIDE = 1024
async function downscale(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.type === 'image/jpeg') return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.8))
  } catch {
    return file
  }
}

export async function analyzePhoto(original: Blob): Promise<PhotoAnalysis> {
  const file = await downscale(original)
  if (!geminiConfigured) throw new Error('Gemini is not configured')
  const base64 = await fileToBase64(file)

  const prompt = `You are assisting an emergency responder. A person who cannot speak has attached this photo to a
silent help request. Describe only what is actually visible — do not invent. Extract:
- dangerIndicators: short responder tags for anything hazardous visible (e.g. "weapon: knife", "person injured -
  bleeding", "fire/smoke", "forced entry", "multiple people"). Empty if nothing dangerous is visible.
- observations: neutral short notes of what's in the frame (people, place, objects, vehicle, signage/location clues).
- urgency: low / medium / high based on visible danger.
- summary: one or two sentences a dispatcher can read at a glance.`

  const response = await generateText({
    model: MODEL,
    task: 'photoVision',
    contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/jpeg', data: base64 } }] }],
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as PhotoAnalysis
}
