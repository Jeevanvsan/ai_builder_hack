/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import type { Incident } from '../../../../shared/incidents/types'
import { distanceM } from '../../../../shared/nav/route.ts'
import { googleMapsKey } from '../../lib/googleMaps'
import { livePosition } from '../../lib/livePosition'

// How far from the caller to look for the nearest street-level imagery.
const SEARCH_RADIUS_M = 100
// Look again only once the caller has moved this far: every new panorama is a billed load.
const RECHECK_M = 75

type State =
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'ready'; date: string | null; distance: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Street View's imagery date is "YYYY-MM".
const imageryMonth = (d: string) => {
  const [y, m] = d.split('-').map(Number)
  return y && m ? `${MONTHS[m - 1]} ${y}` : d
}

function StreetView({ target }: { target: { lat: number; lng: number } }) {
  const sv = useMapsLibrary('streetView')
  const geometry = useMapsLibrary('geometry')
  const divRef = useRef<HTMLDivElement>(null)
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null)
  const checkedAt = useRef<{ lat: number; lng: number } | null>(null)
  const latest = useRef(0)
  const [state, setState] = useState<State>({ kind: 'checking' })

  useEffect(() => {
    if (!sv || !geometry || !divRef.current) return
    if (checkedAt.current && distanceM(checkedAt.current, target) < RECHECK_M) return
    checkedAt.current = { ...target }
    const request = ++latest.current
    // Free: this only asks whether there is imagery near the caller. Showing the panorama below is the billed part.
    new sv.StreetViewService()
      .getPanorama({ location: target, radius: SEARCH_RADIUS_M, source: sv.StreetViewSource.OUTDOOR, preference: sv.StreetViewPreference.NEAREST })
      .then(({ data }) => {
        if (request !== latest.current || !divRef.current) return
        const at = data.location?.latLng
        const pano = data.location?.pano
        if (!at || !pano) {
          setState({ kind: 'none' })
          return
        }
        // Taken from the nearest road, turned to look towards where the caller is.
        const pov = { heading: geometry.spherical.computeHeading(at, target), pitch: 0 }
        if (!panoRef.current) {
          panoRef.current = new sv.StreetViewPanorama(divRef.current, {
            pano,
            pov,
            zoom: 0,
            addressControl: false,
            enableCloseButton: false,
            fullscreenControl: true,
            motionTracking: false,
            motionTrackingControl: false,
            panControl: false,
            showRoadLabels: true,
          })
        } else {
          panoRef.current.setPano(pano)
          panoRef.current.setPov(pov)
        }
        setState({ kind: 'ready', date: data.imageDate ?? null, distance: Math.round(geometry.spherical.computeDistanceBetween(at, target)) })
      })
      .catch(() => {
        if (request === latest.current) setState({ kind: 'none' })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sv, geometry, target.lat, target.lng])

  return (
    <div className="street-view">
      <div ref={divRef} className="street-view-pano" />
      {state.kind === 'checking' && <p className="street-view-msg">Looking for street-level imagery near the caller…</p>}
      {state.kind === 'none' && (
        <p className="street-view-msg">No Street View within {SEARCH_RADIUS_M} m of this spot. Try the Satellite or 3D view on the map.</p>
      )}
      {state.kind === 'ready' && (
        <p className="street-view-meta">
          From the nearest road{state.distance >= 5 ? `, ${state.distance} m from the caller` : ''}, facing them
          {state.date ? ` · imagery from ${imageryMonth(state.date)}` : ''}. Drag to look around; it may have changed since.
        </p>
      )}
    </div>
  )
}

// The "Street view" tab: what the street at the caller's position looks like, so a responder can recognise the
// place (a gate, a shop front, a junction) before arriving. Opened only when the tab is, since it is billed per view.
export default function StreetViewPanel({ incident }: { incident: Incident }) {
  const pos = livePosition(incident.location)
  if (!pos) return <p className="muted">No location yet.</p>
  if (pos.basis === 'ip') {
    return <p className="muted">Only an IP estimate of the location so far, which can be km off. Street View opens once the caller's GPS or address is known.</p>
  }
  return (
    <APIProvider apiKey={googleMapsKey}>
      <StreetView target={{ lat: pos.lat, lng: pos.lng }} />
    </APIProvider>
  )
}
