import { affirmed } from '../../../shared/incidents/severity.ts'
import type { Incident } from '../../../shared/incidents/types.ts'

// Epic 22.5: the facts a responder needs to act, at the top of the incident, filling in live, with a
// completeness meter and a call timer that turns amber once the "order call" passes three minutes.

const WEAPON = /weapon|gun|firearm|knife|blade|blunt|rod|stick/i
const INJURY = /injur|bleed|hurt|wound|blood/i
const SUSPECT = /attacker|suspect|wearing|clothes|build|scooter|motorbike|bike|car|van|vehicle/i

function facts(i: Incident) {
  const danger = affirmed(i.extractedFieldsLive.dangerIndicators)
  const pick = (re: RegExp) => danger.filter((d) => re.test(d))
  const weapon = pick(WEAPON)
  const injury = pick(INJURY)
  const suspect = pick(SUSPECT)
  const situation = danger.filter((d) => !WEAPON.test(d) && !INJURY.test(d) && !SUSPECT.test(d))
  return [
    { key: 'where', label: 'Where', value: i.location.confirmed?.address ?? null },
    { key: 'what', label: "What's happening", value: situation.slice(-2).join(' · ') || null },
    { key: 'danger', label: 'Weapon / injury', value: [...weapon, ...injury].slice(-2).join(' · ') || null },
    { key: 'people', label: 'How many', value: i.extractedFieldsLive.peopleCount != null ? String(i.extractedFieldsLive.peopleCount) : null },
    { key: 'suspect', label: 'Suspect', value: suspect.slice(-2).join(' · ') || null },
    {
      key: 'plate',
      label: 'Vehicle plate',
      value: i.vehicle ? `${i.vehicle.number}${i.vehicle.region ? ` · ${i.vehicle.region}` : ''}${i.vehicle.source === 'camera' ? ' (camera)' : ''}` : null,
    },
  ]
}

export default function CriticalStrip({ incident, live, now }: { incident: Incident; live: boolean; now: number }) {
  const list = facts(incident)
  const known = list.filter((f) => f.value).length
  const endedAt = incident.sessionEndedAt ? Date.parse(incident.sessionEndedAt) : now
  const secs = Math.max(0, Math.floor(((live ? now : endedAt) - Date.parse(incident.sessionStartedAt)) / 1000))
  const overBudget = live && incident.channel === 'live-call' && secs >= 180
  const coercion = (incident.coercionSignals ?? []).filter((c) => (c.confidence ?? 0) >= 60)

  return (
    <div className="critical-strip">
      <div className="critical-head">
        <span className="critical-title">Critical facts</span>
        <span className="critical-meter" title="How many of the critical facts are known">
          <span className="critical-bar"><span style={{ width: `${(known / list.length) * 100}%` }} /></span>
          {known} of {list.length} known
        </span>
        {incident.channel === 'live-call' && (
          <span className={`critical-timer${overBudget ? ' over' : ''}`} title={overBudget ? 'Past the 3-minute order-call budget' : 'Call length'}>
            {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
          </span>
        )}
        {coercion.length > 0 && (
          <span className="coercion-flag" title={coercion.map((c) => `${c.kind}${c.detail ? `: ${c.detail}` : ''}`).join('\n')}>
            Possible coercion
          </span>
        )}
      </div>
      <div className="critical-grid">
        {list.map((f) => (
          <div key={f.key} className={`critical-cell${f.value ? ' known' : ''}`}>
            <small>{f.label}</small>
            <b>{f.value ?? (live ? 'Waiting…' : 'Not given')}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
