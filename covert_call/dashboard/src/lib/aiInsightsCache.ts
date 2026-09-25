import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Insights } from './aiInsights'

const DOC_PATH = ['analytics', 'aiInsights'] as const
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export type CachedInsights = Insights & { generatedAt: string; generatedBy: string }

export async function getCachedInsights(): Promise<CachedInsights | null> {
  const snap = await getDoc(doc(db, ...DOC_PATH))
  return snap.exists() ? (snap.data() as CachedInsights) : null
}

export function isStale(cached: CachedInsights | null): boolean {
  if (!cached) return true
  return Date.now() - Date.parse(cached.generatedAt) > ONE_DAY_MS
}

export function saveInsights(insights: Insights, generatedBy: string): Promise<void> {
  const cached: CachedInsights = { ...insights, generatedAt: new Date().toISOString(), generatedBy }
  return setDoc(doc(db, ...DOC_PATH), cached)
}
