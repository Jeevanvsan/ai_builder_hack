import { AI_MODELS } from '../../../../shared/aiModels'
import { geminiKeys, generateWithFallback } from './keys'
import { GoogleGenAI } from '@google/genai'
import type { FieldConfidence, Incident } from '../../../../shared/incidents/types'

// Native port of web/src/lib/gemini/consolidate.ts — keep the prompt and schema in sync. The only change is
// where the API key comes from.
const MODEL = AI_MODELS.consolidation // shared/aiModels.ts

export type ConsolidationResult = {
  consolidatedSummary: string
  fieldConfidence: Record<string, FieldConfidence>
  bulletin: {
    location: string
    subjects: string
    weapons: string
    vehicle: string
    status: string
    recommendedAction: string
  }
  redactions: string[]
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
    redactions: { type: 'array', items: { type: 'string' } },
  },
  required: ['consolidatedSummary', 'fieldConfidence', 'bulletin', 'redactions'],
}

export async function consolidateCall(
  transcript: string,
  fields: Incident['extractedFieldsLive'],
  voiceStressTrend: Incident['voiceStressTrend'],
  address?: string | null,
  // What the camera and background-sound analysis observed, and any plate. Without this the bulletin only knew what
  // was SAID ("unknown vehicle chasing caller" while the camera had shown a yellow sports car).
  evidence?: { scene?: { source?: string; kind?: string; detail?: string; vehicle?: { type?: string; colour?: string; plate?: string } }[]; plate?: string | null },
): Promise<ConsolidationResult> {
  if (!geminiKeys.configured) throw new Error('Gemini is not configured')
  const avgStress = voiceStressTrend.length
    ? Math.round(voiceStressTrend.reduce((sum, s) => sum + s.score, 0) / voiceStressTrend.length)
    : null

  const prompt = `Emergency dispatcher writing case notes from a call transcript. Data below, no personal info beyond what's in the transcript itself.

Transcript: ${transcript || '(no transcript captured)'}
Extracted so far: peopleCount=${fields.peopleCount ?? '-'} dangerIndicators=${fields.dangerIndicators.join(',') || '-'} urgency=${fields.urgency ?? '-'} notes=${fields.notes ?? '-'}
Confirmed address: ${address ?? '-'}
Seen/heard (camera + background sound): ${(evidence?.scene ?? []).slice(-8).map((o) => `${o.source === 'camera' ? 'seen' : 'heard'}: ${[o.vehicle?.colour, o.vehicle?.type].filter(Boolean).join(' ') || o.detail || o.kind}${o.vehicle?.plate ? `, plate ${o.vehicle.plate}` : ''}`).join('; ') || '-'}
Vehicle plate: ${evidence?.plate ?? '-'}
Avg voice stress: ${avgStress ?? '-'}/100

Write consolidatedSummary: 2-4 sentences, dispatcher case-note style, stating what's known and any uncertainty.
Write fieldConfidence: for each of peopleCount, dangerIndicators, urgency, address, rate confirmed (caller stated
it directly and clearly), inferred (reasonably inferred from context/tone), or uncertain (guessed/unclear).
Write bulletin: a terse, real dispatch-broadcast style breakdown, each field a short fragment (not a sentence),
using "-" if genuinely unknown — location (the confirmed address, or "unconfirmed"), subjects (headcount +
description if known), weapons ("none reported" if none), vehicle ("none reported" if none), status (one short
phrase: ongoing / resolved / caller safe / unknown), recommendedAction (one short imperative dispatch instruction,
e.g. "Dispatch police units, weapon reported" — consistent with the danger indicators and urgency above).

Also act as a privacy reviewer: check whether the caller mentioned any uninvolved third party who did not
consent to being named or described — for example a bystander or a child referred to by name or identifying
detail, where naming them isn't necessary to the report itself. Write redactions: a short list of exactly what
should be redacted (e.g. "child's name: Priya"), or an empty list if nothing needs redacting. Don't flag the
caller themselves or clearly necessary details (like "my neighbor" without a name, or a stated address).`

  const response = await generateWithFallback({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as ConsolidationResult
}
