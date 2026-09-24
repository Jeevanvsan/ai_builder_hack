import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Incident } from '../lib/types'

function FollowTarget({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([lat, lng])
  }, [map, lat, lng])
  return null
}

// Free fallback (no key, no billing) used when no Google Maps key is configured.
export default function OsmIncidentMap({ location }: { location: Incident['location'] }) {
  const { rough, confirmed } = location
  const target = confirmed ?? rough

  return (
    <MapContainer className="map" center={[target.lat, target.lng]} zoom={15} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker center={[rough.lat, rough.lng]} radius={9} pathOptions={{ color: '#5f6673', fillColor: '#8a919c', fillOpacity: 0.9, weight: 2 }}>
        <Tooltip>Approximate location</Tooltip>
      </CircleMarker>
      {confirmed && (
        <>
          {/* Halo + white ring keep the incident pin distinct from the red hospital icons on OSM tiles. */}
          <CircleMarker center={[confirmed.lat, confirmed.lng]} radius={26} interactive={false} pathOptions={{ stroke: false, fillColor: '#c92a2a', fillOpacity: 0.18 }} />
          <CircleMarker center={[confirmed.lat, confirmed.lng]} radius={12} pathOptions={{ color: '#ffffff', fillColor: '#c92a2a', fillOpacity: 1, weight: 4 }}>
            <Tooltip permanent direction="top" offset={[0, -12]}>Incident</Tooltip>
          </CircleMarker>
        </>
      )}
      <FollowTarget lat={target.lat} lng={target.lng} />
    </MapContainer>
  )
}
