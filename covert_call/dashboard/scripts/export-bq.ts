// Epic 26: export ANONYMISED incident stats for the BigQuery sandbox + Looker Studio impact report.
// Run: npm run export:bq   (writes exports/incidents_anonymised.ndjson; upload it as described in
// docs/setup/bigquery-impact.md). No Cloud Functions, so it stays on the free tier.
//
// What leaves: a ~1 km grid cell (never the address or exact pin), hour, weekday, severity, channel, broad danger
// categories, call length and response times. What never leaves: names, notes, transcripts, addresses, plates,
// recordings, demo calls.
import { mkdirSync, writeFileSync } from 'node:fs'
import { collection, getDocs } from 'firebase/firestore'
import { affirmed } from '../../shared/incidents/severity.ts'
import type { Incident } from '../../shared/incidents/types.ts'
import { db } from './db.ts'

const CATEGORIES: [string, RegExp][] = [
  ['weapon', /weapon|gun|firearm|knife|blade|blunt/i],
  ['injury', /injur|bleed|hurt|wound|blood/i],
  ['followed_or_chased', /follow|chase|stalk/i],
  ['domestic', /domestic|home|partner|husband|wife/i],
  ['child', /child|kid/i],
  ['abduction', /abduct|kidnap|taken|confined|locked/i],
  ['hazard', /fire|smoke|gas|hazard|accident/i],
  ['coercion', /coercion/i],
]

// ~1.1 km cells: rounding to 2 decimal places of a degree.
const cell = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 100) / 100 : null)
const minutesBetween = (a?: string | null, b?: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 6000) / 10 : null)

const snap = await getDocs(collection(db, 'incidents'))
const rows = snap.docs.map((d) => {
  const i = d.data() as Omit<Incident, 'id'>
  if (i.isDemo) return null
  const point = i.location.confirmed?.lat != null ? i.location.confirmed : i.location.rough
  const started = new Date(i.sessionStartedAt)
  const danger = affirmed(i.extractedFieldsLive.dangerIndicators)
  return {
    started_date: i.sessionStartedAt.slice(0, 10),
    hour_ist: (started.getUTCHours() + 5 + (started.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24,
    weekday: started.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
    channel: i.channel,
    is_sos: i.incidentType === 'sos',
    severity: i.severity,
    status: i.response.status,
    cell_lat: cell(point?.lat ?? null),
    cell_lng: cell(point?.lng ?? null),
    people_count: i.extractedFieldsLive.peopleCount,
    voice_stress: i.voiceStressScore,
    categories: CATEGORIES.filter(([, re]) => danger.some((t) => re.test(t))).map(([name]) => name),
    call_minutes: minutesBetween(i.sessionStartedAt, i.sessionEndedAt),
    minutes_to_acknowledge: minutesBetween(i.sessionStartedAt, i.response.acknowledgedAt),
    minutes_to_resolve: minutesBetween(i.sessionStartedAt, i.response.resolvedAt),
  }
}).filter((r) => r !== null)

mkdirSync(new URL('../exports/', import.meta.url), { recursive: true })
const out = new URL('../exports/incidents_anonymised.ndjson', import.meta.url)
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
console.log(`Wrote ${rows.length} anonymised rows to dashboard/exports/incidents_anonymised.ndjson`)
process.exit(0)
