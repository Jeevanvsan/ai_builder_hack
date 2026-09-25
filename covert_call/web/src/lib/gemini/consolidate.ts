import { GoogleGenAI } from '@google/genai'
import type { FieldConfidence, Incident } from '../../../../shared/incidents/types.ts'

// Same lite text model as the dashboard's own Gemini feature (dashboard/src/lib/aiInsights.ts) — this is a
// short one-shot summarization task, not a conversation, so the lightest model is enough.
const MODEL = 'gemini-3.5-flash-lite'

export type ConsolidationResult = {
  consolidatedSummary: string
  fieldConfidence: Record<string, FieldConfidence>
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    consolidatedSummary: { type: 'string' },
    fieldConfidence: {
      type: 'object',
      properties: {
        peopleCount: { type: 'string', enum: ['confirmed', 'inferred', 'uncertain'] },
        dangerIndicators: { type: 'string', enum: ['confirmed', 'inferred', 'uncertain'] },
        urgency: { type: 'string', enum: ['confirmed', 'inferred', 'uncertain'] },
        address: { type: 'string', enum: ['confirmed', 'inferred', 'uncertain'] },
      },
    },
  },
  required: ['consolidatedSummary', 'fieldConfidence'],
}

// Turns a call transcript + what was extracted live into a permanent, dispatcher-style case record (Story 3.4),
// run client-side once the call ends — no backend needed for this, matches the rest of the project's stack.
export async function consolidateCall(
  transcript: string,
  fields: Incident['extractedFieldsLive'],
  voiceStressTrend: Incident['voiceStressTrend'],
): Promise<ConsolidationResult> {
  const apiKey = import.meta.env.VITE_GEMINI_LIVE_API_KEY
  if (!apiKey) throw new Error('Gemini is not configured')

  const client = new GoogleGenAI({ apiKey })
  const avgStress = voiceStressTrend.length
    ? Math.round(voiceStressTrend.reduce((sum, s) => sum + s.score, 0) / voiceStressTrend.length)
    : null

  const prompt = `Emergency dispatcher writing case notes from a call transcript. Data below, no personal info beyond what's in the transcript itself.

Transcript: ${transcript || '(no transcript captured)'}
Extracted so far: peopleCount=${fields.peopleCount ?? '-'} dangerIndicators=${fields.dangerIndicators.join(',') || '-'} urgency=${fields.urgency ?? '-'} notes=${fields.notes ?? '-'}
Avg voice stress: ${avgStress ?? '-'}/100

Write consolidatedSummary: 2-4 sentences, dispatcher case-note style, stating what's known and any uncertainty.
Write fieldConfidence: for each of peopleCount, dangerIndicators, urgency, address, rate confirmed (caller stated
it directly and clearly), inferred (reasonably inferred from context/tone), or uncertain (guessed/unclear).`

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as ConsolidationResult
}
