// Resolves the test incidents from the last run (eval/results/latest.json) as a responder, with a team note, so
// they leave the live queue. Needs RESPONDER_EMAIL / RESPONDER_PASSWORD in eval/.env.local.
// From covert_call/eval/:  npm run resolve-tests            (or: -- INC-AAA INC-BBB, -- --open-today, -- --all-open)
import { readFileSync } from 'node:fs'
import { getApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore'
import { INCIDENTS } from '../shared/incidents/client.ts'
import { db, setDemo } from './firebaseNode.ts'

if (!process.env.RESPONDER_EMAIL || !process.env.RESPONDER_PASSWORD) throw new Error('Set RESPONDER_EMAIL and RESPONDER_PASSWORD in eval/.env.local.')
setDemo()
await signInWithEmailAndPassword(getAuth(getApp()), process.env.RESPONDER_EMAIL, process.env.RESPONDER_PASSWORD)
// Incident ids on the command line (e.g. leftovers from a failed attempt) override the last run's list.
// --open-today: every still-open demo incident started today (leftovers from interrupted test runs).
let ids = process.argv.slice(2).filter((a) => a.startsWith('INC-'))
// --all-open: every still-open demo incident, any date (stale "Live" demo calls whose tab was closed mid-call).
const allOpen = process.argv.includes('--all-open')
if (allOpen || process.argv.includes('--open-today')) {
  const { collection, getDocs, query, where } = await import('firebase/firestore')
  const today = new Date().toISOString().slice(0, 10)
  const snap = await getDocs(query(collection(db, INCIDENTS), where('response.status', 'in', ['new', 'acknowledged', 'in_progress'])))
  ids = snap.docs.filter((d) => allOpen || String(d.data().sessionStartedAt ?? '').startsWith(today)).map((d) => d.id)
  if (!ids.length) { console.log('No open demo incidents.'); process.exit(0) }
}
const { results } = ids.length
  ? { results: ids.map((incidentId) => ({ id: 'leftover', incidentId })) }
  : JSON.parse(readFileSync(new URL('./results/latest.json', import.meta.url), 'utf8')) as { results: { id: string; incidentId: string | null }[] }
const at = new Date().toISOString()
for (const r of results) {
  if (!r.incidentId) continue
  const i = (await getDoc(doc(db, INCIDENTS, r.incidentId))).data()
  if (!i || i.response.status === 'resolved') { console.log(`- ${r.incidentId} already resolved`); continue }
  await updateDoc(doc(db, INCIDENTS, r.incidentId), {
    'response.status': 'resolved', 'response.resolvedAt': at,
    'response.notes': arrayUnion({ responderId: process.env.RESPONDER_EMAIL, text: `Auto-resolved by the AI test harness (${r.id}).`, at }),
    ...(i.callState === 'active' ? { callState: 'ended', sessionEndedAt: i.sessionEndedAt ?? at } : {}),
  })
  console.log(`✓ ${r.incidentId} ${r.id} resolved`)
}
process.exit(0)
