import { useEffect, useRef, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Incident } from '../../../shared/incidents/types'
import type { IncidentToast } from '../components/IncidentToasts'
import {
  audioUnlocked,
  notificationsSupported,
  onAudioStateChange,
  playAlertSound,
  playEscalationCue,
  showSystemNotification,
  startRinging,
  stopRinging,
  unlockAudio,
} from './alertOutputs'
import { scopeQuery, toIncident } from './incidentsStore'
import { isUnviewed } from './ranking'

export type AlertPermission = 'granted' | 'denied' | 'default' | 'unsupported'

const BASE_TITLE = 'QuickBite Monitoring Dashboard'

function currentPermission(): AlertPermission {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

// Epic 16.9: a "material change" is address confirmed for the first time, a new danger indicator once the
// incident is already at least medium severity, or urgency escalating past its previously recorded level — not
// just any field write. Returns a short label for the toast so a responder knows why they're being re-alerted.
const SEVERITY_RANK: Record<Incident['severity'], number> = { low: 0, medium: 1, high: 2 }
const URGENCY_RANK: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 1, high: 2 }

function materialChange(before: Incident, after: Incident): string | null {
  if (!before.location.confirmed && after.location.confirmed) return 'Address confirmed'
  const newIndicators = after.extractedFieldsLive.dangerIndicators.filter((d) => !before.extractedFieldsLive.dangerIndicators.includes(d))
  if (newIndicators.length && SEVERITY_RANK[after.severity] >= SEVERITY_RANK.medium) return `New: ${newIndicators[0]}`
  const beforeUrgency = before.extractedFieldsLive.urgency
  const afterUrgency = after.extractedFieldsLive.urgency
  if (afterUrgency && (!beforeUrgency || URGENCY_RANK[afterUrgency] > URGENCY_RANK[beforeUrgency])) return `Urgency raised to ${afterUrgency}`
  return null
}

// Watches open incidents on every page: sound + toast + system notification for each new, unopened incident,
// and again (Epic 16.9) when an already-viewed incident materially changes — a responder who looked away
// shouldn't miss a weapon getting confirmed mid-call just because they already opened it once.
// A toast disappears as soon as any responder opens that incident.
// Rings continuously while any incident is unopened. Do not disturb: while this responder is working an incident page, nothing interrupts them. New arrivals are
// held and surface as silent toasts once they leave, if nobody has opened them in the meantime.
export function useIncidentAlerts() {
  const navigate = useNavigate()
  const busy = useLocation().pathname.startsWith('/incident/')
  const busyRef = useRef(busy)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])
  const [toasts, setToasts] = useState<IncidentToast[]>([])
  const [permission, setPermission] = useState<AlertPermission>(currentPermission)
  const [unviewedCount, setUnviewedCount] = useState(0)
  const [soundUnlocked, setSoundUnlocked] = useState(audioUnlocked)

  useEffect(() => {
    let known: Map<string, Incident> | null = null
    return onSnapshot(scopeQuery('open'), (snap) => {
      const incidents = snap.docs.map((d) => toIncident(d.id, d.data()))
      const unviewed = incidents.filter(isUnviewed)
      setUnviewedCount(unviewed.length)
      document.title = unviewed.length ? `(${unviewed.length}) ${BASE_TITLE}` : BASE_TITLE

      const fresh: IncidentToast[] = known ? unviewed.filter((i) => !known!.has(i.id)) : []

      // Epic 16.9: a re-alert for an already-viewed incident that materially changed — never for a brand-new
      // one (that's `fresh`'s job), so an incident is either a "new incident" toast or a "material change"
      // toast on any given snapshot, never both.
      const changed: IncidentToast[] = []
      if (known) {
        for (const incident of incidents) {
          if (isUnviewed(incident)) continue
          const before = known.get(incident.id)
          if (!before) continue
          const reason = materialChange(before, incident)
          if (reason) changed.push({ ...incident, changeReason: reason })
        }
      }

      known = new Map(incidents.map((i) => [i.id, i]))
      const stillRelevant = new Set([...unviewed.map((i) => i.id), ...changed.map((i) => i.id)])

      setToasts((prev) => [
        ...fresh,
        ...changed,
        ...prev.filter((t) => stillRelevant.has(t.id) && !fresh.some((f) => f.id === t.id) && !changed.some((c) => c.id === t.id)),
      ])
      if (!busyRef.current) {
        fresh.forEach((i) => showSystemNotification(i, () => navigate(`/incident/${i.id}`)))
        if (changed.length) playEscalationCue()
      }
    })
  }, [navigate])

  // Browsers keep audio locked until the user interacts with the page; any click or key press unlocks it.
  useEffect(() => {
    const unsubscribe = onAudioStateChange(setSoundUnlocked)
    document.addEventListener('pointerdown', unlockAudio)
    document.addEventListener('keydown', unlockAudio)
    return () => {
      unsubscribe()
      document.removeEventListener('pointerdown', unlockAudio)
      document.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  // Ring until every incident has been opened by someone; never while this responder is on an incident page.
  // Re-runs when sound unlocks, so the ring starts immediately instead of on the next interval.
  const shouldRing = unviewedCount > 0 && !busy
  useEffect(() => {
    if (shouldRing && soundUnlocked) startRinging()
    else stopRinging()
  }, [shouldRing, soundUnlocked])

  useEffect(() => () => {
    stopRinging()
    document.title = BASE_TITLE
  }, [])

  const enable = async () => {
    await unlockAudio()
    if (notificationsSupported() && Notification.permission === 'default') {
      setPermission(await Notification.requestPermission())
    }
    // Test sound only when not already ringing, so two sirens never overlap.
    if (unviewedCount === 0 || busy) playAlertSound()
  }

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return { toasts: busy ? [] : toasts, dismiss, permission, enable, soundBlocked: shouldRing && !soundUnlocked }
}
