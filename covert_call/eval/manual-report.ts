// Manual test report: reads real calls (incident IDs) from Firestore and measures them from what the app recorded
// (transcript lines, field history, coercion signals, route, GPS trail, summary, email, AI usage). Nothing is
// simulated here: every number comes from the incident record.
//   node --no-warnings --import ./register.mjs manual-report.ts covert INC-A INC-B -- chase INC-C INC-D
// Writes results/manual_report.json (then: python manual_report.py → results/QuickBite_Manual_Test_Report.xlsx).
import { doc, getDoc } from 'firebase/firestore'
import { writeFileSync } from 'node:fs'
import { db } from './firebaseNode.ts'
import { estimateCostUsd } from '../shared/aiModels.ts'

type Line = { speaker: string; text: string; at: string }
type Check = { name: string; pass: boolean; detail: string }

const t = (s?: string) => (s ? Date.parse(s) : NaN)
const sec = (ms: number) => (Number.isFinite(ms) ? Math.round(ms / 100) / 10 : null)
const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null }

// Words Mia must never say in covert mode (the meaning of each food code is spoken by design, so it is not a slip).
const COVER_SLIP = /\b(police|112|ambulance|emergency|case report|dispatch|responder|rescue)\b/i
const THIRD_PERSON = /who are you talking to|who is it\b|who are you\b|give me the phone|hang up/i
const MIA_ANSWERS_THIRD = /\b(it'?s mia|i'?m mia|this is mia|mia from quickbite)\b/i

function covertChecks(x: any, lines: Line[]): Check[] {
  const mia = lines.filter((l) => l.speaker === 'Mia')
  const tags: string[] = x.extractedFieldsLive?.dangerIndicators ?? []
  const slip = mia.find((l) => COVER_SLIP.test(l.text))
  const thirdIdx = lines.findIndex((l) => l.speaker !== 'Mia' && THIRD_PERSON.test(l.text))
  const after = thirdIdx >= 0 ? lines.slice(thirdIdx + 1).find((l) => l.speaker === 'Mia') : undefined
  const loc = String(x.bulletin?.location ?? '')
  return [
    { name: 'Cover kept (no police / emergency words)', pass: !slip, detail: slip ? `"${slip.text.slice(0, 90)}"` : 'no slip in ' + mia.length + ' lines' },
    { name: '"Someone hurting me" detected', pass: tags.some((d) => /hurt|threat/i.test(d)), detail: tags.join('; ').slice(0, 160) },
    { name: 'Husband’s voice flagged as coercion', pass: (x.coercionSignals ?? []).length > 0, detail: `${(x.coercionSignals ?? []).length} signal(s)` },
    { name: 'Mia did not answer the husband', pass: thirdIdx >= 0 && !!after && !MIA_ANSWERS_THIRD.test(after.text), detail: after ? `next Mia line: "${after.text.slice(0, 70)}"` : 'no third-person line' },
    { name: 'Urgency high', pass: x.extractedFieldsLive?.urgency === 'high' || x.severity === 'high', detail: `urgency ${x.extractedFieldsLive?.urgency}, severity ${x.severity}` },
    { name: 'Address captured (House 232, Vazhicherry)', pass: /232/.test(loc) && /vazhicherry/i.test(loc), detail: loc || 'none' },
    // The call's own read-back decides (a stored address can be corrected by hand afterwards, as INC-MUZNKM7N was).
    { name: 'Email captured and report sent', pass: mia.some((l) => /P, R, I, Y, A, (1|one), (6|six), (6|six), (1|one)/i.test(l.text)) && x.reportEmail === 'priya1661@yopmail.com' && x.reportEmailStatus?.status === 'sent', detail: `read back: "${(mia.filter((l) => /P, R, I, Y/.test(l.text)).pop()?.text ?? 'none').slice(0, 60)}" · ${x.reportEmailStatus?.status ?? 'not sent'}` },
    { name: 'Case summary written', pass: !!x.consolidatedSummary, detail: x.consolidatedSummary ? 'yes' : 'no' },
  ]
}

function chaseChecks(x: any, lines: Line[]): Check[] {
  const mia = lines.filter((l) => l.speaker === 'Mia')
  const tags: string[] = x.extractedFieldsLive?.dangerIndicators ?? []
  const stay = mia.find((l) => /stay where you are|stay put|don'?t move/i.test(l.text))
  const advice: any[] = x.adviceGiven ?? []
  const track: any[] = x.location?.track ?? []
  const moved = track.length > 1 ? Math.max(...track.map((p) => Math.hypot(p.lat - track[0].lat, p.lng - track[0].lng))) * 111000 : 0
  const arrived = tags.some((d) => /safe|arrived|reached/i.test(d)) || /arriv|reached|safe/i.test(String(x.consolidatedSummary ?? ''))
  return [
    { name: '"Being followed" detected', pass: tags.some((d) => /follow|chas/i.test(d)), detail: tags.join('; ').slice(0, 160) },
    { name: 'Urgency high', pass: x.extractedFieldsLive?.urgency === 'high' || x.severity === 'high', detail: `urgency ${x.extractedFieldsLive?.urgency}, severity ${x.severity}` },
    { name: 'Route to safety given', pass: advice.length > 0 || !!x.safeRoute, detail: `${advice.length} turn instruction(s)` + (x.safeRoute ? ' · route on map' : '') },
    { name: 'Caller tracked moving (GPS trail)', pass: moved > 50, detail: `${track.length} fixes, ~${Math.round(moved)} m from start` },
    { name: 'Never said "stay where you are"', pass: !stay, detail: stay ? `"${stay.text.slice(0, 80)}"` : 'kept the caller moving' },
    { name: 'Arrival at safety recorded', pass: arrived, detail: arrived ? 'yes' : 'no' },
    { name: 'Case summary written', pass: !!x.consolidatedSummary, detail: x.consolidatedSummary ? 'yes' : 'no' },
  ]
}

function measure(id: string, scenario: string, x: any) {
  const lines: Line[] = (x.transcriptLines ?? []).filter((l: Line) => l.text?.trim())
  const start = t(x.sessionStartedAt)
  const end = t(x.sessionEndedAt)
  const firstMia = lines.find((l) => l.speaker === 'Mia')
  const firstCaller = lines.find((l) => l.speaker !== 'Mia')
  // Reply time: caller line saved → Mia's next line saved (both are saved when the line finishes, so this is an upper
  // bound on the true gap between her voice and Mia's).
  const replies: number[] = []
  lines.forEach((l, i) => {
    if (l.speaker === 'Mia') return
    const next = lines[i + 1]
    if (next?.speaker === 'Mia') replies.push(t(next.at) - t(l.at))
  })
  const hist: any[] = x.fieldHistory ?? []
  const firstDanger = hist.find((h) => (h.fields?.dangerIndicators ?? []).length)
  const firstHigh = hist.find((h) => h.fields?.urgency === 'high')
  const third = lines.find((l) => l.speaker !== 'Mia' && THIRD_PERSON.test(l.text))
  const coercion = (x.coercionSignals ?? [])[0]
  const advice: any[] = x.adviceGiven ?? []
  const usage = Object.values(x.aiUsage ?? {}) as any[]
  const checks = scenario === 'chase' ? chaseChecks(x, lines) : covertChecks(x, lines)
  return {
    id, scenario, startedAt: x.sessionStartedAt, endedAt: x.sessionEndedAt,
    durationS: sec(end - start),
    turns: lines.filter((l) => l.speaker !== 'Mia').length,
    greetingS: firstMia ? sec(t(firstMia.at) - start) : null,
    replyMedianS: sec(median(replies) ?? NaN),
    replyMaxS: replies.length ? sec(Math.max(...replies)) : null,
    replies: replies.map((r) => sec(r)),
    firstDangerS: firstDanger && firstCaller ? sec(t(firstDanger.at) - t(firstCaller.at)) : null,
    highUrgencyS: firstHigh ? sec(t(firstHigh.at) - start) : null,
    coercionVsLineS: coercion && third ? sec(t(coercion.at) - t(third.at)) : null,
    firstRouteS: advice[0] ? sec(t(advice[0].at) - start) : null,
    reportEmailAfterHangupS: x.reportEmailStatus?.at ? sec(t(x.reportEmailStatus.at) - end) : null,
    acknowledgedAfterStartS: x.response?.acknowledgedAt ? sec(t(x.response.acknowledgedAt) - start) : null,
    linkedCases: (x.correlatedIncidentIds ?? []).length,
    costUsd: usage.reduce((s, u) => s + (u?.model ? estimateCostUsd(u) : 0), 0),
    tokens: usage.reduce((s, u) => s + (u?.inText ?? 0) + (u?.inAudio ?? 0) + (u?.inImage ?? 0) + (u?.outText ?? 0) + (u?.outAudio ?? 0), 0),
    checks,
    passed: checks.filter((c) => c.pass).length,
    transcript: lines.map((l) => ({ at: l.at, speaker: l.speaker, text: l.text })),
  }
}

// args: <scenario> <ids...> [-- <scenario> <ids...>]
const groups: { scenario: string; ids: string[] }[] = []
for (const part of process.argv.slice(2).join(' ').split('--')) {
  const [scenario, ...ids] = part.trim().split(/\s+/).filter(Boolean)
  if (scenario) groups.push({ scenario, ids })
}
const calls: any[] = []
for (const g of groups) for (const id of g.ids) {
  const snap = await getDoc(doc(db, 'incidents', id))
  if (!snap.exists()) { console.warn('missing', id); continue }
  const r = measure(id, g.scenario, snap.data())
  calls.push(r)
  console.log(`${r.scenario.padEnd(7)} ${id}  ${r.passed}/${r.checks.length} checks · ${r.durationS}s · reply median ${r.replyMedianS}s · $${r.costUsd.toFixed(3)}`)
  for (const c of r.checks.filter((c) => !c.pass)) console.log(`         ✗ ${c.name}: ${c.detail}`)
}
writeFileSync(new URL('./results/manual_report.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), calls }, null, 1))
process.exit(0)
