// Free tier first, paid credits as the fallback (web, dashboard and native all use this).
//
// Two Gemini API keys from two projects: one on the free tier, one with billing/credits. Every request uses the
// free key until it answers with a quota error, then the paid key takes over FOR THAT MODEL (free-tier quotas are
// per model: Flash running out says nothing about Flash-Lite): until the next daily reset for a
// per-day quota, or for ~90 s for a per-minute one (free-tier Live is ~65K tokens/minute, so two calls at once can
// hit it). The switch is remembered (localStorage when there is one) so the next request doesn't waste a doomed
// free attempt. With only one key set, that key is simply always used.

export type KeyTier = 'free' | 'paid'
type Store = { get(k: string): string | null; set(k: string, v: string): void }

const QUOTA = /RESOURCE_EXHAUSTED|\b429\b|quota|rate.?limit|exceeded your current/i
export const isQuotaError = (e: unknown) => QUOTA.test(typeof e === 'string' ? e : `${(e as { message?: string })?.message ?? ''} ${String(e)}`)

const PER_MINUTE_MS = 90_000
// Free-tier daily quotas reset at midnight Pacific time.
function nextPacificMidnight(now = Date.now()): number {
  const PT = 8 * 3_600_000 // UTC-8 (PST); in PDT this is an hour early, which only means retrying free sooner
  const ptNow = now - PT
  return ptNow - (ptNow % 86_400_000) + 86_400_000 + PT
}

function browserStore(): Store | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    if (!ls) return null
    return { get: (k) => { try { return ls.getItem(k) } catch { return null } }, set: (k, v) => { try { ls.setItem(k, v) } catch { /* private mode */ } } }
  } catch {
    return null
  }
}

export function createKeyPool(keys: { free?: string; paid?: string }, name = 'gemini') {
  const free = keys.free?.trim() || undefined
  const paid = keys.paid?.trim() || undefined
  const store = browserStore()
  const storeKey = (model: string) => `qb-${name}-free-blocked-until:${model}`
  const blocked = new Map<string, number>()
  const blockedUntil = (model: string) => {
    if (!blocked.has(model)) blocked.set(model, Number(store?.get(storeKey(model)) ?? 0) || 0)
    return blocked.get(model)!
  }

  const tierNow = (model: string): KeyTier => (free && (!paid || Date.now() >= blockedUntil(model)) ? 'free' : 'paid')

  return {
    configured: Boolean(free || paid),
    hasFree: Boolean(free),
    // The key to use right now for `model`, and which tier it is.
    current(model = '*'): { key: string; tier: KeyTier } {
      const tier = tierNow(model)
      return { key: (tier === 'free' ? free : paid) ?? free ?? '', tier }
    },
    // Call after a failed request made on `tier`. Returns true when it was the free tier running out and a paid
    // key exists, i.e. the caller should retry the same request once on the paid key.
    failed(tier: KeyTier, err: unknown, model = '*'): boolean {
      if (tier !== 'free' || !paid || !isQuotaError(err)) return false
      const until = /PerDay|per day|daily/i.test(String((err as { message?: string })?.message ?? err)) ? nextPacificMidnight() : Date.now() + PER_MINUTE_MS
      blocked.set(model, until)
      store?.set(storeKey(model), String(until))
      return true
    },
    // The paid key was refused too (spend cap, its own rate limit): forget the free block for this model so the
    // next request tries free again instead of failing on paid until the reset.
    unblock(model = '*') {
      blocked.set(model, 0)
      store?.set(storeKey(model), '0')
    },
  }
}

export type KeyPool = ReturnType<typeof createKeyPool>

// Runs one request with the pool for `model`: free key first, the same request once more on the paid key if free
// is out of quota; and if the paid key is refused (e.g. spend cap) while free was marked out, free once more.
export async function withKeyFallback<T>(pool: KeyPool, run: (key: string, tier: KeyTier) => Promise<T>, model = '*'): Promise<T> {
  const { key, tier } = pool.current(model)
  try {
    return await run(key, tier)
  } catch (e) {
    if (pool.failed(tier, e, model)) {
      const next = pool.current(model)
      return run(next.key, next.tier)
    }
    if (tier === 'paid' && pool.hasFree && isQuotaError(e)) {
      pool.unblock(model)
      const retry = pool.current(model)
      if (retry.tier === 'free') return run(retry.key, retry.tier)
    }
    throw e
  }
}
