// Which model does which job: the smallest model that does each task well. Spreading tasks across models also
// gives each its own free-tier quota (free limits are per model), so one busy task can't starve the others.
// Prices (paid tier, USD per 1M tokens in/out, 2026-10): 3.5 Flash-Lite 0.30/2.50, 3.1 Flash-Lite 0.25/1.50,
// Gemma 4 free (slow, weak at strict JSON). 2.5 Flash-Lite (0.10/0.40) is no longer available to new projects.
// Used by web, dashboard, native and eval. Mapping table: docs/ai_models.md.
export const AI_MODELS = {
  // Real-time voice + camera conversation (Mia) and the silent SOS observer: only the Live model can do this.
  liveCall: 'gemini-3.8-live',
  // Post-call case summary + dispatch bulletin + third-party redactions from the full transcript: the most
  // important write-up a responder reads, so the strongest Lite model.
  consolidation: 'gemini-3.5-flash-lite',
  // Photo from a silent tap: spot a weapon, injury, plate. Vision needs a capable model, but not the top one.
  photoVision: 'gemini-3.1-flash-lite',
  // Smart search on the dashboard: rank incident digests against a plain-language query.
  smartSearch: 'gemini-3.1-flash-lite',
  // Simple structured judgements: same-person/vehicle case linking, caller credibility, daily AI Insights.
  caseLinking: 'gemini-3.1-flash-lite',
  credibility: 'gemini-3.1-flash-lite',
  insights: 'gemini-3.1-flash-lite',
  // Paused (aiFeatures.groundedContext): weather/road context needs Google Search grounding.
  groundedContext: 'gemini-3.5-flash-lite',
  // Test harness only: the simulated caller (short natural lines, many per call) and the semantic judge (yes/no).
  evalCaller: 'gemini-3.1-flash-lite',
  evalJudge: 'gemma-4-31b-it',
} as const

// ---- Usage + cost (shown on the staging /ai-usage page) -------------------------------------------------------
// Paid-tier USD per 1M tokens (Gemini API pricing page, 2026-10). Image/video input on Live is billed like audio.
// Estimates only: free-tier requests cost nothing, and Google's bill is the source of truth.
type Rates = { inText: number; inAudio: number; inImage: number; outText: number; outAudio: number }
export const AI_PRICES: Record<string, Rates> = {
  'gemini-3.8-live': { inText: 0.75, inAudio: 3.0, inImage: 3.0, outText: 4.5, outAudio: 12.0 },
  'gemini-3.8-live-extended-thinking': { inText: 0.75, inAudio: 3.0, inImage: 3.0, outText: 4.5, outAudio: 12.0 },
  'gemini-3.5-flash-lite': { inText: 0.3, inAudio: 0.3, inImage: 0.3, outText: 2.5, outAudio: 2.5 },
  'gemini-3.1-flash-lite': { inText: 0.25, inAudio: 0.5, inImage: 0.25, outText: 1.5, outAudio: 1.5 },
  'gemma-4-31b-it': { inText: 0, inAudio: 0, inImage: 0, outText: 0, outAudio: 0 },
}
export const USD_TO_INR = 88

// What one task used during a call, as stored on the incident (incidents/{id}.aiUsage.<task>), summed with
// Firestore increments as each response arrives.
export type AiTaskUsage = {
  model: string
  tier?: 'free' | 'paid' // key tier of the latest request
  requests: number // model inferences (a Live call re-reads the session on each one)
  inText: number; inAudio: number; inImage: number // prompt tokens by modality
  outText: number; outAudio: number // response tokens by modality
  ms?: number // total request time (text tasks)
}
export const AI_USAGE_FIELDS = ['requests', 'inText', 'inAudio', 'inImage', 'outText', 'outAudio', 'ms'] as const

export function estimateCostUsd(u: Partial<AiTaskUsage> & { model: string }): number {
  const r = AI_PRICES[u.model] ?? AI_PRICES['gemini-3.5-flash-lite']
  return ((u.inText ?? 0) * r.inText + (u.inAudio ?? 0) * r.inAudio + (u.inImage ?? 0) * r.inImage + (u.outText ?? 0) * r.outText + (u.outAudio ?? 0) * r.outAudio) / 1e6
}

// Splits a Gemini usageMetadata (any SDK) into the fields above.
type Detail = { modality?: string; tokenCount?: number }
export function usageFromMetadata(m: { promptTokenCount?: number; responseTokenCount?: number; candidatesTokenCount?: number; promptTokensDetails?: Detail[]; responseTokensDetails?: Detail[]; candidatesTokensDetails?: Detail[] } | undefined) {
  const out = { inText: 0, inAudio: 0, inImage: 0, outText: 0, outAudio: 0 }
  if (!m) return out
  const add = (details: Detail[] | undefined, total: number | undefined, dir: 'in' | 'out') => {
    if (!details?.length) { if (dir === 'in') out.inText += total ?? 0; else out.outText += total ?? 0; return }
    for (const d of details) {
      const n = d.tokenCount ?? 0
      const mod = String(d.modality ?? 'TEXT').toUpperCase()
      if (dir === 'in') { if (mod === 'AUDIO') out.inAudio += n; else if (mod === 'IMAGE' || mod === 'VIDEO') out.inImage += n; else out.inText += n }
      else { if (mod === 'AUDIO') out.outAudio += n; else out.outText += n }
    }
  }
  add(m.promptTokensDetails, m.promptTokenCount, 'in')
  add(m.responseTokensDetails ?? m.candidatesTokensDetails, m.responseTokenCount ?? m.candidatesTokenCount, 'out')
  return out
}
