import { GoogleGenAI } from '@google/genai'
import type { FieldConfidence, Incident } from '../../../../shared/incidents/types.ts'

// Same lite text model as the dashboard's own Gemini feature (dashboard/src/lib/aiInsights.ts) — this is a
// short one-shot summarization task, not a conversation, so the lightest model is enough.
const MODEL = 'gemini-3.5-flash-lite'

export type ConsolidationResult = {
  consolidatedSummary: string
  fieldConfidence: Record<string, FieldConfidence>
  // Epic 16.4: a rigid, dispatch-bulletin-style breakdown alongside the prose summary — terse fragments, not
  // sentences, formatted the way a real dispatch broadcast reads (see the hotel-call transcript's "LAPD be
  // advised" line). recommendedAction mirrors the same deterministic line Epic 16.3 already shows live.
  bulletin: {
    location: string
    subjects: string
    weapons: string
    vehicle: string
    status: string
    recommendedAction: string
  }
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
    bulletin: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        subjects: { type: 'string' },
        weapons: { type: 'string' },
        vehicle: { type: 'string' },
        status: { type: 'string' },
        recommendedAction: { type: 'string' },
      },
      required: ['location', 'subjects', 'weapons', 'vehicle', 'status', 'recommendedAction'],
    },
  },
  required: ['consolidatedSummary', 'fieldConfidence', 'bulletin'],
}

// Turns a call transcript + what was extracted live into a permanent, dispatcher-style case record (Story 3.4),
// run client-side once the call ends — no backend needed for this, matches the rest of the project's stack.
export async function consolidateCall(
  transcript: string,
  fields: Incident['extractedFieldsLive'],
  voiceStressTrend: Incident['voiceStressTrend'],
  address?: string | null,
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
Confirmed address: ${address ?? '-'}
Avg voice stress: ${avgStress ?? '-'}/100

Write consolidatedSummary: 2-4 sentences, dispatcher case-note style, stating what's known and any uncertainty.
Write fieldConfidence: for each of peopleCount, dangerIndicators, urgency, address, rate confirmed (caller stated
it directly and clearly), inferred (reasonably inferred from context/tone), or uncertain (guessed/unclear).
Write bulletin: a terse, real dispatch-broadcast style breakdown, each field a short fragment (not a sentence),
using "-" if genuinely unknown — location (the confirmed address, or "unconfirmed"), subjects (headcount +
description if known), weapons ("none reported" if none), vehicle ("none reported" if none), status (one short
phrase: ongoing / resolved / caller safe / unknown), recommendedAction (one short imperative dispatch instruction,
e.g. "Dispatch police units, weapon reported" — consistent with the danger indicators and urgency above).`

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as ConsolidationResult
}
