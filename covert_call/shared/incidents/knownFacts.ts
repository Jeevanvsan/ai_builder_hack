import { affirmed } from './severity.ts'
import type { Incident } from './types.ts'

// Epic 22.2: a short "what is already known" note for Mia, built from the live incident (what the caller said,
// what the camera saw, what was heard), so she never asks for something we already have and knows what's missing.

type Live = Omit<Incident, 'id'>

const MOVING = /(followed|chased|chasing|stalked|fleeing|escaping|on the move|moving around|abduct|taken somewhere|running away|in the road|leaving the (house|home|room|building))/i

export const isCallerMoving = (i: Live) => i.extractedFieldsLive.dangerIndicators.some((d) => MOVING.test(d))

const hasWeaponOrInjury = (tags: string[]) => tags.some((d) => /weapon|gun|knife|blade|injur|bleed|hurt|blunt|no (weapon|injur)/i.test(d))

export function knownFactsNote(i: Live): string {
  const tags = affirmed(i.extractedFieldsLive.dangerIndicators)
  const allTags = i.extractedFieldsLive.dangerIndicators
  const known: string[] = []
  const needed: string[] = []

  const address = i.location.confirmed?.address
  if (address) known.push(`location = ${address}`)
  else needed.push(isCallerMoving(i) ? 'where they are right now (a landmark) and which way they are heading' : 'exact location (building, floor, flat or landmark)')

  if (tags.length) known.push(`situation = ${tags.slice(-6).join('; ')}`)
  else needed.push('what is happening')

  if (!hasWeaponOrInjury(allTags)) needed.push('immediate danger: any weapon or injury')
  if (i.extractedFieldsLive.peopleCount != null) known.push(`people = ${i.extractedFieldsLive.peopleCount}`)
  if (i.extractedFieldsLive.urgency) known.push(`urgency = ${i.extractedFieldsLive.urgency}`)
  if (i.vehicle) known.push(`vehicle plate = ${i.vehicle.number}`)

  // A vehicle Mia already saw on camera: say so plainly, or she still asks the caller to describe it (INC-MUWL4J6Q).
  const car = [...(i.sceneObservations ?? [])].reverse().find((o) => o.source === 'camera' && (o.category === 'vehicle' || o.vehicle))
  if (car) {
    const v = car.vehicle ?? {}
    const desc = [v.colour, v.type].filter(Boolean).join(' ') || car.detail || car.kind
    known.push(`attacker's vehicle already identified on camera = ${desc}${v.plate ?? i.vehicle?.number ? `, plate ${v.plate ?? i.vehicle?.number}` : ''} (do NOT ask the caller to describe it)`)
  }

  const seen = (i.sceneObservations ?? []).slice(-4).map((o) => `${o.source === 'camera' ? 'seen' : 'heard'}: ${o.detail || o.kind}`)
  if (seen.length) known.push(seen.join('; '))

  const knownText = known.length ? known.join(' | ') : 'nothing yet'
  const neededText = needed.length ? needed.join('; ') : 'nothing essential — only ask more if it changes the response'
  return `(System note, not the caller — known so far: ${knownText}. Still needed: ${neededText}. Do not reply to this note; never ask about anything already known.)`
}
