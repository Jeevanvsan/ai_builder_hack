// The post-call steps the QuickBite app runs when a call ends (web/src/pages/CallPage.tsx): Gemini case summary +
// leakage check, grounded location context, and linking related cases. The AI test runs them after every call so
// the dashboard's case record completes, and times each step.
//
// Standalone (fills in incidents from the last test run that don't have a summary yet), from covert_call/eval/:
//   npm run postcall
import { doc, getDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { consolidateIncident, INCIDENTS, recordCorrelatedIncidents, recordGroundedContext, recordLeakageCheck } from '../shared/incidents/client.ts'
import type { Incident } from '../shared/incidents/types.ts'
import { setUsageIncident } from '../web/src/lib/gemini/aiLogic.ts'
import { consolidateCall } from '../web/src/lib/gemini/consolidate.ts'
import { findCorrelatedIncidents } from '../web/src/lib/gemini/correlate.ts'
import { groundedLocationContext } from '../web/src/lib/gemini/groundedContext.ts'

export type PostCallMetrics = { consolidateMs: number | null; consolidated: boolean; groundedMs: number | null; correlateMs: number | null; linkedCases: number }

export async function runPostCall(db: Firestore, id: string): Promise<PostCallMetrics> {
  setUsageIncident(db, id) // the post-call requests are counted on this incident's AI usage, as in the app
  const m: PostCallMetrics = { consolidateMs: null, consolidated: false, groundedMs: null, correlateMs: null, linkedCases: 0 }
  const incident = (await getDoc(doc(db, INCIDENTS, id))).data() as Omit<Incident, 'id'> | undefined
  if (!incident) return m
  const transcript = (incident.transcriptLines ?? []).map((l) => `${l.speaker}: ${l.text}`).join('\n')
  const fields = incident.extractedFieldsLive
  const address = incident.location.confirmed?.address ?? null
  const withRetry = <T,>(fn: () => Promise<T>) => fn().catch(() => fn())

  let t = Date.now()
  try {
    const c = await withRetry(() => consolidateCall(transcript, fields, incident.voiceStressTrend ?? [], address, { scene: incident.sceneObservations, plate: incident.vehicle?.number ?? null }))
    await Promise.all([consolidateIncident(db, id, c), recordLeakageCheck(db, id, c.redactions)])
    m.consolidated = true
  } catch {
    await updateDoc(doc(db, INCIDENTS, id), { consolidationFailed: true }).catch(() => {})
  }
  m.consolidateMs = Date.now() - t

  if (address) {
    t = Date.now()
    const context = await groundedLocationContext(address).catch(() => null)
    if (context) await recordGroundedContext(db, id, context)
    m.groundedMs = Date.now() - t
  }
  t = Date.now()
  const ids = await findCorrelatedIncidents(db, { ...incident, id } as Incident).catch(() => [] as string[])
  if (ids.length) await recordCorrelatedIncidents(db, id, ids)
  m.correlateMs = Date.now() - t
  m.linkedCases = ids.length
  return m
}

if (process.argv[1]?.endsWith('postcall.ts')) {
  const { db, setDemo } = await import('./firebaseNode.ts')
  setDemo()
  const { readFileSync } = await import('node:fs')
  const { results } = JSON.parse(readFileSync(new URL('./results/latest.json', import.meta.url), 'utf8')) as { results: { id: string; incidentId: string | null }[] }
  for (const r of results) {
    if (!r.incidentId) continue
    const snap = (await getDoc(doc(db, INCIDENTS, r.incidentId))).data() as Omit<Incident, 'id'> | undefined
    if (!snap || snap.consolidatedSummary) { console.log(`- ${r.incidentId} already done`); continue }
    const m = await runPostCall(db, r.incidentId)
    console.log(`${m.consolidated ? '✓' : '✗'} ${r.incidentId} ${r.id} · summary ${m.consolidateMs} ms · linked ${m.linkedCases}`)
  }
  process.exit(0)
}
