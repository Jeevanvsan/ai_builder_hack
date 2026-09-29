import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIncidents } from './incidentsStore'
import { rankOpenIncidents } from './ranking'

// Epic 20.1: pressing "N" from anywhere in the dashboard jumps straight to whichever open, unacknowledged
// incident currently ranks highest — the same ranking the live queue already sorts by, just as a shortcut to
// its result. Ignored while typing in an input/textarea so it doesn't fire while a responder is adding a note.
export function useNextUrgentHotkey() {
  const navigate = useNavigate()
  const { data: incidents } = useIncidents('open')
  const incidentsRef = useRef(incidents)
  useEffect(() => {
    incidentsRef.current = incidents
  }, [incidents])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const ranked = rankOpenIncidents(incidentsRef.current ?? [])
      if (ranked.length) {
        e.preventDefault()
        navigate(`/incident/${ranked[0].id}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate])
}
