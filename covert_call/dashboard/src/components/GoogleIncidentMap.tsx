import { useEffect } from 'react'
import { AdvancedMarker, APIProvider, Map, Pin, useMap } from '@vis.gl/react-google-maps'
import type { Incident } from '../lib/types'

function FollowTarget({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map?.panTo({ lat, lng })
  }, [map, lat, lng])
  return null
}

export default function GoogleIncidentMap({ location, apiKey }: { location: Incident['location']; apiKey: string }) {
  const { rough, confirmed } = location
  const target = confirmed ?? rough

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        className="map"
        defaultCenter={{ lat: target.lat, lng: target.lng }}
        defaultZoom={15}
        mapId="DEMO_MAP_ID"
        disableDefaultUI
        zoomControl
      >
        <AdvancedMarker position={{ lat: rough.lat, lng: rough.lng }} title="Approximate location">
          <Pin background="#8a919c" borderColor="#5f6673" glyphColor="#ffffff" />
        </AdvancedMarker>
        {confirmed && (
          <AdvancedMarker position={{ lat: confirmed.lat, lng: confirmed.lng }} title={confirmed.address}>
            <Pin background="#c92a2a" borderColor="#8f1d1d" glyphColor="#ffffff" />
          </AdvancedMarker>
        )}
        <FollowTarget lat={target.lat} lng={target.lng} />
      </Map>
    </APIProvider>
  )
}
