// Plays a scripted QuickBite call into Firestore so the dashboard can be watched updating live.
import { arrayUnion, doc, setDoc, terminate, updateDoc } from 'firebase/firestore'
import { db } from './db.ts'

// 6 digits so simulated IDs never collide with the 4-digit seeded ones.
const id = `INC-${Date.now().toString().slice(-6)}`
const ref = doc(db, 'incidents', id)
const now = () => new Date().toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const stressCurve = [38, 44, 52, 61, 66, 72, 79, 84, 81, 86, 83, 77, 70, 64]

const events: Record<number, () => Record<string, unknown>> = {
  4: () => ({ 'extractedFieldsLive.peopleCount': 2 }),
  8: () => ({ 'extractedFieldsLive.dangerIndicators': ['aggressor present'], severity: 'medium', 'extractedFieldsLive.urgency': 'medium' }),
  12: () => ({ 'extractedFieldsLive.urgency': 'high', severity: 'high' }),
  15: () => ({
    'location.confirmed': {
      address: '12th Main Road, HSR Layout, Bengaluru',
      lat: 12.9121,
      lng: 77.6446,
      confidence: 'confirmed',
      confirmedAt: now(),
    },
  }),
  19: () => ({ 'extractedFieldsLive.dangerIndicators': ['aggressor present', 'weapon mentioned'] }),
  22: () => ({ 'extractedFieldsLive.notes': 'Caller speaking quietly; second person audible nearby.' }),
  26: () => ({ callState: 'ended', sessionEndedAt: now() }),
  30: () => ({
    consolidatedSummary:
      'Caller at a residence in HSR Layout reported two people present, one of them an aggressor, and indicated a weapon is present. Voice stress rose sharply mid-call and stayed high. Address was confirmed in conversation. Treat as high urgency.',
    fieldConfidence: { peopleCount: 'confirmed', dangerIndicators: 'confirmed', urgency: 'inferred' },
    leakageCheckStatus: { reviewed: true, redactions: ['name of second person'] },
  }),
}

const startedAt = now()
await setDoc(ref, {
  sessionStartedAt: startedAt,
  sessionEndedAt: null,
  channel: 'live-call',
  callState: 'active',
  location: { rough: { lat: 12.9116, lng: 77.6389, source: 'gps', capturedAt: startedAt }, confirmed: null },
  extractedFieldsLive: { peopleCount: null, dangerIndicators: [], urgency: null, notes: null },
  consolidatedSummary: null,
  fieldConfidence: {},
  voiceStressScore: null,
  voiceStressTrend: [],
  leakageCheckStatus: { reviewed: false, redactions: [] },
  severity: 'low',
  response: { status: 'new', acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null, notes: [] },
})
console.log(`Started ${id}. Open /incident/${id} on the dashboard.`)

for (let t = 1; t <= 30; t++) {
  await sleep(1000)
  const update: Record<string, unknown> = events[t]?.() ?? {}
  if (t <= 26 && t % 2 === 0) {
    const score = stressCurve[t / 2 - 1]
    update.voiceStressScore = score
    update.voiceStressTrend = arrayUnion({ timestamp: now(), score })
  }
  if (Object.keys(update).length) {
    await updateDoc(ref, update)
    console.log(`t+${t}s`, Object.keys(update).join(', '))
  }
}

console.log(`Done. ${id} is now a consolidated case record.`)
await terminate(db)
