import { useEffect } from 'react'
import { AdvancedMarker, APIProvider, Map, Pin, useMap } from '@vis.gl/react-google-maps'
import type { MapProps } from './mapTypes'

function FollowTarget({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map?.panTo({ lat, lng })
  }, [map, lat, lng])
  return null
}

export default function GoogleIncidentMap({ rough, confirmed, target, apiKey, backdrop }: MapProps & { apiKey: string }) {
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        className="map"
        defaultCenter={{ lat: target.lat, lng: target.lng }}
        defaultZoom={backdrop ? 16 : 15}
        mapId="DEMO_MAP_ID"
        disableDefaultUI
        zoomControl={!backdrop}
        gestureHandling={backdrop ? 'none' : 'auto'}
        keyboardShortcuts={!backdrop}
      >
        {rough && (
          <AdvancedMarker position={{ lat: rough.lat, lng: rough.lng }} title="Approximate location">
            <Pin background="#8a919c" borderColor="#5f6673" glyphColor="#ffffff" />
          </AdvancedMarker>
        )}
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
