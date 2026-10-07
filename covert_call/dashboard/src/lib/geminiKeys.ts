import { createKeyPool, withKeyFallback } from '../../../shared/gemini/keyPool.ts'

// Dashboard Gemini key(s): the free-tier key first, the paid (credits) key once free is out of quota
// (shared/gemini/keyPool.ts). Used by AI Insights, credibility and smart search.
export const geminiKeys = createKeyPool({
  free: import.meta.env.VITE_GEMINI_API_KEY_FREE as string | undefined,
  paid: import.meta.env.VITE_GEMINI_API_KEY as string | undefined,
}, 'dashboard')

// fetch() against a Gemini REST endpoint with the current key; a 429 on the free key is retried once on the paid key.
export function geminiFetch(endpoint: string, init: RequestInit): Promise<Response> {
  const model = endpoint.match(/models\/([^:]+):/)?.[1] ?? '*'
  return withKeyFallback(geminiKeys, async (key) => {
    const res = await fetch(`${endpoint}?key=${key}`, init)
    if (res.status === 429) throw new Error(`429 RESOURCE_EXHAUSTED ${await res.clone().text().catch(() => '')}`)
    return res
  }, model).catch((e) => {
    // Paid key also rate-limited (or no paid key): hand back a 429 so the caller's normal error path runs.
    if (/429/.test(String(e))) return new Response(null, { status: 429 })
    throw e
  })
}
