import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-3.5-flash-lite'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    redactions: { type: 'array', items: { type: 'string' } },
  },
  required: ['redactions'],
}

// Story 2.2: a second Gemini pass checks the call for anyone mentioned who didn't consent to being named or
// described — a bystander, a child — and flags what should be redacted before a responder reads it.
export async function runLeakageCheck(transcript: string): Promise<string[]> {
  const apiKey = import.meta.env.VITE_GEMINI_LIVE_API_KEY
  if (!apiKey || !transcript.trim()) return []

  const client = new GoogleGenAI({ apiKey })
  const prompt = `Privacy reviewer for an emergency-call transcript. Check whether the caller mentioned any
uninvolved third party who did not consent to being named or described — for example a bystander or a child
referred to by name or identifying detail, where naming them isn't necessary to the report itself.

Transcript: ${transcript}

Return redactions: a short list of exactly what should be redacted (e.g. "child's name: Priya"), or an empty
list if nothing needs redacting. Don't flag the caller themselves or clearly necessary details (like "my
neighbor" without a name, or a stated address).`

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const text = response.text
  if (!text) return []
  const parsed = JSON.parse(text) as { redactions?: string[] }
  return parsed.redactions ?? []
}
