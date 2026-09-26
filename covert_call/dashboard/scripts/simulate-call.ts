// Plays a scripted QuickBite call through the shared incident client (the same functions the QuickBite app calls),
// so the dashboard can be watched updating live. Node has no GPS, so the rough location comes from the IP fallback.
import { doc, terminate, updateDoc } from 'firebase/firestore'
import { db } from './db.ts'
import {
  confirmAddress,
  endIncident,
  INCIDENTS,
  recordVoiceStress,
  startIncident,
  updateLiveFields,
  appendTrackPoint,
  setSafeRoute,
} from '../../shared/incidents/client.ts'
import { bestSafeRoute, progressOnRoute } from '../../shared/nav/route.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stressCurve = [38, 44, 52, 61, 66, 72, 79, 84, 81, 86, 83, 77, 70, 64]

const { id, located } = await startIncident(db, { channel: 'live-call' })
console.log(`Started ${id}. Open /incident/${id} on the dashboard.`)

const steps: Record<number, () => Promise<unknown>> = {
  4: () => updateLiveFields(db, id, { peopleCount: 2 }),
  8: () => updateLiveFields(db, id, { dangerIndicators: ['aggressor present'], urgency: 'medium' }),
  12: () => updateLiveFields(db, id, { urgency: 'high' }),
  15: () => confirmAddress(db, id, '12th Main Road, HSR Layout, Bengaluru').then((c) => console.log('  address:', c)),
  19: () => updateLiveFields(db, id, { dangerIndicators: ['aggressor present', 'weapon mentioned'] }),
  22: () => updateLiveFields(db, id, { notes: 'Caller speaking quietly; second person audible nearby.' }),
  26: () => endIncident(db, id),
  // Stand-in for the Story 3.4 post-call Gemini consolidation pass, which needs a backend.
  30: () =>
    updateDoc(doc(db, INCIDENTS, id), {
      consolidatedSummary:
        'Caller at a residence in HSR Layout reported two people present, one of them an aggressor, and indicated a weapon is present. Voice stress rose sharply mid-call and stayed high. Address was confirmed in conversation. Treat as high urgency.',
      fieldConfidence: { peopleCount: 'confirmed', dangerIndicators: 'confirmed', urgency: 'inferred' },
      leakageCheckStatus: { reviewed: true, redactions: ['name of second person'] },
    }),
}

void located.then((rough) => console.log('  rough location:', rough))

// --moving: the caller flees along real streets while the route to safety updates live (route-to-safety feature).
if (process.argv.includes('--moving')) {
  const start = { lat: 12.9121, lng: 77.6446 }
  await updateLiveFields(db, id, { dangerIndicators: ['someone following or chasing caller', 'attacker in a car'], urgency: 'high' })
  let route = await bestSafeRoute(start, 'police', 'being chased by a car', 'ai')
  if (!route) throw new Error('Could not compute a route (Overpass/OSRM unreachable?)')
  await setSafeRoute(db, id, route)
  console.log(`  route to ${route.destination.name}: ${route.distanceM} m, ${route.durationS} s, ${route.steps.length} steps`)
  const path = route.geometry.filter((_, i) => i % 3 === 0)
  for (const [lat, lng] of path) {
    await sleep(2000)
    await appendTrackPoint(db, id, { lat, lng, speed: 8 })
    const prog = progressOnRoute({ lat, lng }, route)
    if (prog.stepIndex !== route.stepIndex) {
      route = { ...route, stepIndex: prog.stepIndex }
      await setSafeRoute(db, id, route)
      console.log(`  next: ${prog.next?.instruction}`)
    }
  }
  await endIncident(db, id)
  console.log(`Arrived. ${id} ended.`)
  await terminate(db)
  process.exit(0)
}

for (let t = 1; t <= 30; t++) {
  await sleep(1000)
  const work: Promise<unknown>[] = []
  if (steps[t]) work.push(steps[t]())
  if (t <= 26 && t % 2 === 0) work.push(recordVoiceStress(db, id, stressCurve[t / 2 - 1]))
  if (work.length) {
    await Promise.all(work)
    console.log(`t+${t}s`)
  }
}

await located
console.log(`Done. ${id} is now a consolidated case record.`)
await terminate(db)
