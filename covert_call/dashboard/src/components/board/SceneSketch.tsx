import { affirmed, isNegatedIndicator } from '../../../../shared/incidents/severity'
import type { Incident } from '../../../../shared/incidents/types'

// Live scene sketch: a hand-drawn diagram of the situation, redrawn as facts come in. Built only from what was
// reported (affirmed danger tags, the vehicle plate, GPS, coercion signals, the route), never guessed: anything
// not reported yet is drawn as a dashed "?" outline, and a fact the caller ruled out ("no weapon") is shown as such.
// Each new element sketches itself in (keyed by the fact, so it animates the moment it appears).

const COLORS: [RegExp, string, string][] = [
  [/white|silver/i, '#f4f4f2', 'white'],
  [/black|dark/i, '#2b2f36', 'dark'],
  [/red|maroon/i, '#c92a2a', 'red'],
  [/blue/i, '#2b6cb0', 'blue'],
  [/grey|gray/i, '#8a919c', 'grey'],
  [/green/i, '#2f9e44', 'green'],
  [/yellow/i, '#f2c94c', 'yellow'],
]
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, an: 1 }
const KIND_COLOR = { police: '#2c4a9e', fire: '#b8391f', hospital: '#1f7a45' } as const
const VEHICLE = /\b(car|vehicle|bike|motorbike|scooter|van|truck|lorry|auto|rickshaw|jeep|suv)\b/i

type WeaponKind = 'gun' | 'knife' | 'blunt' | 'weapon'

function read(i: Incident) {
  const raw = i.extractedFieldsLive.dangerIndicators
  const danger = affirmed(raw)
  const text = danger.join(' | ')
  const has = (re: RegExp) => re.test(text)
  const ruledOut = (re: RegExp) => raw.some((d) => isNegatedIndicator(d) && re.test(d))

  const weapon: WeaponKind | null = has(/gun|firearm|pistol|revolver|shot/i) ? 'gun'
    : has(/knife|blade|stab|machete|sickle/i) ? 'knife'
      : has(/rod|stick|bat|blunt|iron|pipe/i) ? 'blunt'
        : has(/weapon|armed/i) ? 'weapon' : null

  const vehicleText = danger.filter((d) => VEHICLE.test(d)).join(' ')
  const plate = i.vehicle
  const hasVehicle = Boolean(vehicleText || plate)
  const vtype = /bike|scooter|motorbike/i.test(vehicleText) ? 'two-wheeler'
    : /auto|rickshaw/i.test(vehicleText) ? 'auto'
      : /van|truck|lorry/i.test(vehicleText) ? 'van' : 'car'
  const color = COLORS.find(([re]) => re.test(vehicleText))

  const countMatch = text.match(/\b(\d+|one|two|three|four|five)\s+(men|man|people|persons?|attackers?|guys|suspects?|strangers?)\b/i)
  const subjectCount = countMatch ? (Number(countMatch[1]) || WORDS[countMatch[1].toLowerCase()] || 1) : null
  const subjectDescribed = Boolean(weapon || countMatch || has(/attacker|suspect|stranger|\bman\b|\bmen\b|follow|chas|threat|someone|husband|boyfriend|subject/i))
  const clothing = danger.find((d) => /wearing|shirt|jacket|hoodie|cloth|helmet|mask/i.test(d)) ?? null
  const track = i.location.track ?? []
  const last = track[track.length - 1]

  return {
    weapon,
    weaponRuledOut: !weapon && ruledOut(/weapon|gun|knife|armed/i),
    injured: has(/injur|blood|bleed|hurt|wound/i),
    injuryRuledOut: ruledOut(/injur|hurt|blood|bleed/i),
    chasing: has(/follow|chas|pursu|tailing/i),
    present: has(/still (present|here|outside|nearby)|inside the house|at the door/i),
    hasVehicle, vtype, color, plate, vehicleText,
    inVehicle: hasVehicle && /attacker|subject|suspect|driving|in a|on a|rider|car follow|bike follow/i.test(vehicleText),
    subjectCount, subjectDescribed, clothing,
    darkClothes: Boolean(clothing && /dark|black/i.test(clothing)),
    moving: track.length >= 2,
    speedKmh: last?.speed != null ? Math.round(last.speed * 3.6) : null,
    coercion: i.coercionSignals ?? [],
    stress: i.voiceStressScore ?? null,
    route: i.safeRoute ?? null,
    address: i.location.confirmed?.address ?? null,
    empty: raw.length === 0 && i.extractedFieldsLive.peopleCount == null && !plate,
  }
}

function Person({ fill, dashed }: { fill: string; dashed?: boolean }) {
  return (
    <g className="sk-stroke" fill={dashed ? 'none' : fill} stroke={dashed ? '#9aa3af' : '#22262d'} strokeDasharray={dashed ? '3 3' : undefined}>
      <circle cy="-15" r="6" />
      <path d="M-9 10 C-9 -2 -5 -7 0 -7 C5 -7 9 -2 9 10 Z" />
    </g>
  )
}

function WeaponIcon({ kind }: { kind: WeaponKind }) {
  return (
    <g className="sk-stroke" stroke="#d92a3f" fill="none" strokeWidth="2" strokeLinecap="round">
      {kind === 'gun' && <path d="M0 0 h14 v4 h-8 l-2 6 h-3 l1-6 h-2 z" fill="#d92a3f" />}
      {kind === 'knife' && <><path d="M0 8 L12 -4 L14 -2 L3 10 Z" fill="#fde2e4" /><path d="M-2 10 L3 5" strokeWidth="3" /></>}
      {kind === 'blunt' && <path d="M0 10 L14 -4" strokeWidth="4" />}
      {kind === 'weapon' && <><path d="M7 -5 L7 5" /><circle cx="7" cy="9" r="0.8" fill="#d92a3f" /><circle cx="7" cy="3" r="9" /></>}
    </g>
  )
}

function Vehicle({ type, fill, rider }: { type: string; fill: string; rider?: string }) {
  const body = type === 'two-wheeler'
    ? <><circle cx="-12" cy="8" r="6" fill="none" /><circle cx="12" cy="8" r="6" fill="none" /><path d="M-12 8 L-2 -4 H8 L12 8 M-2 -4 L-6 -10" fill="none" /></>
    : type === 'auto'
      ? <><path d="M-20 8 V-6 Q-14 -18 6 -16 L18 -2 V8 Z" fill={fill} /><circle cx="-12" cy="9" r="4" fill="#fff" /><circle cx="12" cy="9" r="4" fill="#fff" /></>
      : <><path d={type === 'van' ? 'M-30 8 V-16 H14 L26 -4 V8 Z' : 'M-28 8 V-2 L-18 -14 H10 L22 -2 H28 V8 Z'} fill={fill} />
        <path d={type === 'van' ? 'M14 -14 L23 -4 H14 Z' : 'M-15 -11 H8 L16 -3 H-21 Z'} fill="#dfe8f3" />
        <circle cx="-16" cy="9" r="5" fill="#fff" /><circle cx="16" cy="9" r="5" fill="#fff" /></>
  return (
    <g>
      <g className="sk-stroke" stroke="#22262d" strokeWidth="1.8" strokeLinejoin="round">{body}</g>
      {/* The rider sits on a two-wheeler; in a car or van they show through the windscreen */}
      {rider && (type === 'two-wheeler'
        ? <g transform="translate(0, -14) scale(0.8)"><Person fill={rider} /></g>
        : <circle cx={type === 'van' ? 8 : 0} cy="-8" r="4.5" fill={rider} stroke="#22262d" strokeWidth="1.4" />)}
    </g>
  )
}

export default function SceneSketch({ incident }: { incident: Incident }) {
  const s = read(incident)
  if (s.empty) return <p className="panel-empty">The sketch draws itself as facts are reported.</p>

  const route = s.route
  const subjectX = 74
  const callerX = route ? 210 : 270
  const n = Math.min(s.subjectCount ?? 1, 3)
  const km = route ? (route.distanceM >= 1000 ? `${(route.distanceM / 1000).toFixed(1)} km` : `${route.distanceM} m`) : ''
  const mins = route ? Math.max(1, Math.round(route.durationS / 60)) : 0
  const stressHot = (s.stress ?? 0) >= 70
  const subjectFill = s.darkClothes ? '#2b2f36' : '#f3c1c6'

  const subjectBits = [
    s.subjectCount && s.subjectCount > 1 ? `${s.subjectCount} people` : null,
    s.darkClothes ? 'dark clothes' : null,
    s.weapon ? (s.weapon === 'weapon' ? 'armed' : `${s.weapon}`) : s.weaponRuledOut ? 'no weapon' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="sketch">
      <svg viewBox="0 0 360 230" className="sketch-svg" role="img"
        aria-label={`Scene sketch: ${s.subjectDescribed ? `suspect${subjectBits ? `, ${subjectBits}` : ''}` : 'suspect not described'}${s.chasing ? ', following the caller' : ''}${route ? `, caller heading to ${route.destination.name}` : ''}`}>
        <defs>
          <filter id="sk-pencil"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="2.4" /></filter>
          <pattern id="sk-paper" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#e9edf3" strokeWidth="0.7" /></pattern>
          <marker id="sk-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="#d92a3f" strokeWidth="2" /></marker>
          <marker id="sk-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="#1a73e8" strokeWidth="2" /></marker>
        </defs>
        <rect width="360" height="230" fill="#fffdf8" />
        <rect width="360" height="230" fill="url(#sk-paper)" />

        <g filter="url(#sk-pencil)">
          {/* Road */}
          <path className="sk-draw" pathLength={1} d="M0 96 Q180 90 360 97" stroke="#b9c2cf" strokeWidth="1.6" fill="none" />
          <path className="sk-draw" pathLength={1} d="M0 150 Q180 156 360 149" stroke="#b9c2cf" strokeWidth="1.6" fill="none" />
          <path d="M0 123 H360" stroke="#d3dae4" strokeWidth="1.4" strokeDasharray="12 10" />

          {/* Subject(s): a dashed "?" until the caller describes them */}
          <g key={`subj-${n}-${s.subjectDescribed}-${s.inVehicle}-${s.vtype}`} className="sk-pop" transform={`translate(${subjectX}, 128)`}>
            {s.inVehicle && <g transform="scale(1.25)"><Vehicle type={s.vtype} fill={s.color?.[1] ?? '#cfd5de'} rider={subjectFill} /></g>}
            {!s.inVehicle && Array.from({ length: s.subjectDescribed ? n : 1 }, (_, k) => (
              <g key={k} transform={`translate(${(k - (n - 1) / 2) * 20}, ${k % 2 ? 4 : 0})`}>
                <Person fill={subjectFill} dashed={!s.subjectDescribed} />
              </g>
            ))}
            {!s.subjectDescribed && <text className="sk-q" y="-1">?</text>}
            {s.weapon && <g key={s.weapon} className="sk-pop" transform="translate(12, -30)"><WeaponIcon kind={s.weapon} /></g>}
          </g>
          {s.present && <text className="sk-note" x={subjectX} y="160">still there</text>}

          {/* A vehicle reported but not as the subject's: parked beside them */}
          {s.hasVehicle && !s.inVehicle && (
            <g key={`veh-${s.vtype}`} className="sk-pop" transform={`translate(${subjectX}, 200) scale(0.7)`}>
              <Vehicle type={s.vtype} fill={s.color?.[1] ?? '#cfd5de'} />
            </g>
          )}

          {/* Pursuit */}
          {s.chasing && (
            <g key="chase">
              <path className="sk-draw" pathLength={1} d={`M${subjectX + 34} 122 Q${(subjectX + callerX) / 2} 108 ${callerX - 24} 116`} stroke="#d92a3f" strokeWidth="2.4" fill="none" markerEnd="url(#sk-red)" />
              <text className="sk-hand sk-red" x={(subjectX + callerX) / 2} y="104">following!</text>
            </g>
          )}

          {/* Caller */}
          <g transform={`translate(${callerX}, 128)`}>
            {s.moving && (
              <g key="moving" className="sk-pop" stroke="#2b6cb0" strokeWidth="1.6" strokeLinecap="round">
                <path d="M-26 0 h-12 M-24 6 h-16 M-26 12 h-10" />
              </g>
            )}
            {s.stress != null && <circle className={stressHot ? 'sk-pulse' : undefined} r="22" fill="none" stroke={stressHot ? '#d92a3f' : '#2b6cb0'} strokeWidth="1.4" strokeDasharray="4 4" opacity="0.7" />}
            <Person fill="#a9c7ea" />
            {s.injured && <g key="inj" className="sk-pop" transform="translate(11, -22)"><circle r="6" fill="#fff" stroke="#d92a3f" strokeWidth="1.6" /><path d="M-3 0H3M0 -3V3" stroke="#d92a3f" strokeWidth="1.8" /></g>}
            {s.coercion.length > 0 && (
              <g key="coerce" className="sk-pop" transform="translate(-14, -34)">
                <path d="M-9 0 Q0 -8 9 0 Q0 8 -9 0 Z" fill="#fff" stroke="#b8391f" strokeWidth="1.5" />
                <circle r="2.6" fill="#b8391f" />
              </g>
            )}
          </g>
          <text className="sk-hand sk-blue" x={callerX} y="174">caller{s.injured ? ', hurt' : s.injuryRuledOut ? ', not hurt' : ''}</text>
          {s.moving && <text className="sk-note" x={callerX} y="188">on the move{s.speedKmh ? ` · ${s.speedKmh} km/h` : ''}</text>}

          {/* Route to safety */}
          {route && (
            <g key={`route-${route.destination.name}`}>
              <path className="sk-draw" pathLength={1} d={`M${callerX + 24} 128 Q${(callerX + 316) / 2} 140 300 128`} stroke="#1a73e8" strokeWidth="2.8" fill="none" strokeLinecap="round" markerEnd="url(#sk-blue)" />
              <g className="sk-pop" transform="translate(326, 124)">
                <path d="M-15 12 V-6 L0 -17 L15 -6 V12 Z" fill={KIND_COLOR[route.destination.kind]} stroke="#22262d" strokeWidth="1.4" />
                <path d="M-4 12 V3 H4 V12" fill="#fff" />
              </g>
              <text className="sk-hand sk-blue" x="318" y="96">{route.destination.kind}</text>
              <text className="sk-note" x="318" y="160">{km} · {mins} min</text>
            </g>
          )}
        </g>

        {/* Caption labels and the plate sit outside the pencil filter so they stay crisp */}
        {s.plate && (
          <g key={s.plate.number} className="sk-pop" transform={`${s.inVehicle ? `translate(${subjectX}, 166)` : `translate(${subjectX + 60}, 200)`}`}>
            <rect x="-38" y="-9" width="76" height="17" rx="3" fill="#fffbe6" stroke="#22262d" strokeWidth="1.4" />
            <text className="sk-plate" y="4">{s.plate.number}</text>
          </g>
        )}
        <text className="sk-label sk-red" x={subjectX} y="34">{s.subjectDescribed ? (s.subjectCount && s.subjectCount > 1 ? 'suspects' : 'suspect') : 'suspect: not described'}</text>
        {subjectBits && <text className="sk-sub" x={subjectX} y="48">{subjectBits}</text>}
        {s.address && <text className="sk-sub" x="180" y="222">📍 {s.address.length > 60 ? `${s.address.slice(0, 58)}…` : s.address}</text>}
      </svg>

      <ul className="sk-facts">
        {s.chasing && <li className="danger">Caller is being followed{s.inVehicle ? ` by a ${s.vtype}` : ''}<em>caller</em></li>}
        {s.weapon && <li className="danger">Weapon: {s.weapon === 'weapon' ? 'type not said' : s.weapon}<em>caller</em></li>}
        {s.weaponRuledOut && <li className="ok">No weapon seen<em>caller</em></li>}
        {s.injured && <li className="danger">Caller is hurt<em>caller</em></li>}
        {s.present && <li className="danger">Suspect is still there<em>caller</em></li>}
        {s.clothing && <li>{s.clothing.charAt(0).toUpperCase() + s.clothing.slice(1)}<em>caller</em></li>}
        {s.plate && <li>Plate {s.plate.number}{s.plate.region ? ` · ${s.plate.region}` : ''}<em>{s.plate.source === 'camera' ? 'camera' : 'caller'}</em></li>}
        {!s.plate && s.vehicleText && <li>Vehicle: {s.vehicleText}<em>caller</em></li>}
        {s.coercion.length > 0 && <li className="danger">Caller may not be speaking freely: {s.coercion[s.coercion.length - 1].detail}<em>AI</em></li>}
        {s.moving && <li>Moving{s.speedKmh ? ` at ${s.speedKmh} km/h` : ''}<em>GPS</em></li>}
        {route && <li className="route">Heading to {route.destination.name}: {km}, about {mins} min<em>route</em></li>}
        {!s.subjectDescribed && <li className="unknown">Suspect not described yet<em>missing</em></li>}
      </ul>
    </div>
  )
}
