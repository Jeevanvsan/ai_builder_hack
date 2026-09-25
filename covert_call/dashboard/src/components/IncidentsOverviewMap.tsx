import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import type { Severity } from '../../../shared/incidents/types'

const SEVERITY_COLOR: Record<Severity, string> = { high: '#c92a2a', medium: '#b35c00', low: '#2b6cb0' }

type Point = { id: string; lat: number; lng: number; severity: Severity; label: string }

// Fits the view to every point instead of a fixed zoom, so incidents spread across a wide area (or a single
// point) are all visible without manual zooming.
function FitToPoints({ points }: { points: Point[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    const bounds = latLngBounds(points.map((p): [number, number] => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [32, 32] })
  }, [map, points])
  return null
}

// Free Leaflet/OSM overview of every incident with a known location, colour-coded by severity — used by
// analytics, not the single-incident detail map (see IncidentMap.tsx) which needs the rough-vs-confirmed distinction.
export default function IncidentsOverviewMap({ points }: { points: Point[] }) {
  if (points.length === 0) return <div className="map map-loading">No located incidents yet.</div>

  return (
    <MapContainer className="map" center={[points[0].lat, points[0].lng]} zoom={11} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={9}
          pathOptions={{ color: '#ffffff', fillColor: SEVERITY_COLOR[p.severity], fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip>
            <Link to={`/incident/${p.id}`}>{p.label}</Link> · {p.severity}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitToPoints points={points} />
    </MapContainer>
  )
}
