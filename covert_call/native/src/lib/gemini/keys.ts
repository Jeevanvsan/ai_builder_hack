// Native port of web/src/lib/gemini/aiLogic.ts's key handling — keep the two in sync.
// Free-tier key first, the paid (credits) key once free is out of quota (shared/gemini/keyPool.ts).
import { GoogleGenAI, type Session } from '@google/genai'
import { createKeyPool, isQuotaError, withKeyFallback, type KeyTier } from '../../../../shared/gemini/keyPool'
import { GEMINI_API_KEY, GEMINI_API_KEY_FREE } from '../config'

export const geminiKeys = createKeyPool({ free: GEMINI_API_KEY_FREE, paid: GEMINI_API_KEY }, 'native')

type GenerateParams = Parameters<GoogleGenAI['models']['generateContent']>[0]
export function generateWithFallback(req: GenerateParams) {
  return withKeyFallback(geminiKeys, (apiKey) => new GoogleGenAI({ apiKey }).models.generateContent(req), req.model)
}

// A quota close right after opening marks free as used up; the session's own reconnect then reopens on the paid
// key. A resumption handle belongs to the project that issued it, so it's dropped when the key changes.
type ConnectParams = Parameters<GoogleGenAI['live']['connect']>[0]
let lastLiveTier: KeyTier | null = null
export function liveConnectWithFallback(p: ConnectParams): Promise<Session> {
  const open = (apiKey: string, tier: KeyTier) => {
    const resumption = p.config?.sessionResumption
    const config = resumption?.handle && lastLiveTier && lastLiveTier !== tier ? { ...p.config, sessionResumption: {} } : p.config
    lastLiveTier = tier
    return new GoogleGenAI({ apiKey }).live.connect({
      ...p,
      config,
      callbacks: {
        ...p.callbacks,
        onclose: (e: CloseEvent) => {
          if (isQuotaError(e?.reason ?? '')) geminiKeys.failed(tier, e?.reason ?? 'quota', p.model)
          p.callbacks.onclose?.(e)
        },
      },
    })
  }
  return withKeyFallback(geminiKeys, open, p.model)
}
