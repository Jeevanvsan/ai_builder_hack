import { useEffect, useRef, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Incident } from '../../../shared/incidents/types'
import {
  audioUnlocked,
  notificationsSupported,
  onAudioStateChange,
  playAlertSound,
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

// Watches open incidents on every page: sound + toast + system notification for each new, unopened incident.
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
  const [toasts, setToasts] = useState<Incident[]>([])
  const [permission, setPermission] = useState<AlertPermission>(currentPermission)
  const [unviewedCount, setUnviewedCount] = useState(0)
  const [soundUnlocked, setSoundUnlocked] = useState(audioUnlocked)

  useEffect(() => {
    let known: Set<string> | null = null
    return onSnapshot(scopeQuery('open'), (snap) => {
      const incidents = snap.docs.map((d) => toIncident(d.id, d.data()))
      const unviewed = incidents.filter(isUnviewed)
      setUnviewedCount(unviewed.length)
      document.title = unviewed.length ? `(${unviewed.length}) ${BASE_TITLE}` : BASE_TITLE

      const fresh = known ? unviewed.filter((i) => !known!.has(i.id)) : []
      known = new Set(incidents.map((i) => i.id))
      const stillUnviewed = new Set(unviewed.map((i) => i.id))

      setToasts((prev) => [...fresh, ...prev.filter((t) => stillUnviewed.has(t.id) && !fresh.some((f) => f.id === t.id))])
      if (fresh.length && !busyRef.current) {
        fresh.forEach((i) => showSystemNotification(i, () => navigate(`/incident/${i.id}`)))
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
