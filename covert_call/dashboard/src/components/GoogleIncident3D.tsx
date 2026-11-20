/// <reference types="google.maps" />
import { useEffect } from 'react'
import { APIProvider, Pin } from '@vis.gl/react-google-maps'
import { Map3D, MapMode, Marker3D, Polyline3D, useMap3D } from '@vis.gl/react-google-maps/3d'
import { DEST_COLOR, type MapProps } from './mapTypes'

// How far the camera sits from the caller, in metres, and how steeply it looks down (0 is straight down).
const RANGE_M = 500
const TILT_DEG = 60

// Keeps the camera on the caller as they move, without changing how far out or how tilted the responder has set it.
function FollowTarget3D({ lat, lng }: { lat: number; lng: number }) {
  const map3d = useMap3D()
  useEffect(() => {
    if (!map3d) return
    map3d.flyCameraTo({
      endCamera: { center: { lat, lng, altitude: 0 }, range: map3d.range ?? RANGE_M, tilt: map3d.tilt ?? TILT_DEG, heading: map3d.heading ?? 0 },
      durationMillis: 800,
    })
  }, [map3d, lat, lng])
  return null
}

// The "Google Earth" view: photorealistic 3D (real buildings where Google has them, as in Singapore; elsewhere, such
// as most of India, satellite imagery over terrain), with the same route, trail and pins as the street map.
export default function GoogleIncident3D({ rough, confirmed, target, live, track, route, apiKey }: MapProps & { apiKey: string }) {
  const current = live ? target : null
  const pin = current ?? confirmed ?? rough ?? target
  return (
    <APIProvider apiKey={apiKey}>
      <Map3D
        className="map map-3d"
        mode={MapMode.HYBRID}
        defaultCenter={{ lat: target.lat, lng: target.lng, altitude: 0 }}
        defaultRange={RANGE_M}
        defaultTilt={TILT_DEG}
        defaultHeading={0}
      >
        {route && (
          <Polyline3D
            path={route.geometry}
            strokeColor="#1a73e8"
            strokeWidth={8}
            outerColor="#ffffff"
            outerWidth={0.35}
            altitudeMode="CLAMP_TO_GROUND"
            drawsOccludedSegments
          />
        )}
        {(track?.length ?? 0) > 1 && (
          <Polyline3D path={track!} strokeColor="#0b57d0" strokeWidth={5} altitudeMode="CLAMP_TO_GROUND" drawsOccludedSegments />
        )}
        {route && (
          <Marker3D position={route.destination} altitudeMode="CLAMP_TO_GROUND" label={route.destination.name} drawsWhenOccluded sizePreserved zIndex={20}>
            <Pin background={DEST_COLOR[route.destination.kind]} borderColor="#ffffff" glyphColor="#ffffff" />
          </Marker3D>
        )}
        <Marker3D
          position={pin}
          altitudeMode="CLAMP_TO_GROUND"
          label={current ? 'Caller (live)' : confirmed ? 'Incident' : 'Approximate location'}
          drawsWhenOccluded
          sizePreserved
          zIndex={30}
        >
          <Pin
            background={current ? '#2b6cb0' : confirmed ? '#c92a2a' : '#8a919c'}
            borderColor="#ffffff"
            glyphColor="#ffffff"
          />
        </Marker3D>
        <FollowTarget3D lat={target.lat} lng={target.lng} />
      </Map3D>
    </APIProvider>
  )
}
