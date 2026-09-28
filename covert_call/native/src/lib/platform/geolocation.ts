import * as Location from 'expo-location'

// React Native has no `navigator.geolocation`. Two pieces of shared/web code depend on it and are otherwise
// reused unchanged on native:
//   - shared/incidents/location.ts  — the incident's first rough fix (falls back to IP lookup without this)
//   - web/src/lib/nav/liveTracking.ts — the live GPS trail + route guidance, which needs an accuracy figure
//     better than 100 m or it ignores the fix entirely
// So instead of forking either file, install an expo-location-backed implementation with the same shape.
// expo-location's LocationObject already matches GeolocationPosition closely (coords.latitude/longitude/
// accuracy/speed + timestamp), so positions pass straight through.

type PositionCallback = (position: GeolocationPosition) => void
type ErrorCallback = (error: { code: number; message: string }) => void
type Options = { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2

const toPosition = (l: Location.LocationObject): GeolocationPosition =>
  ({
    coords: {
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      accuracy: l.coords.accuracy ?? 9999,
      altitude: l.coords.altitude,
      altitudeAccuracy: l.coords.altitudeAccuracy,
      heading: l.coords.heading,
      speed: l.coords.speed,
    },
    timestamp: l.timestamp,
  }) as GeolocationPosition

// Cached so repeated calls don't re-prompt; the first call is what shows the OS permission dialog.
let permission: Promise<boolean> | null = null
const ensurePermission = (): Promise<boolean> => {
  if (!permission) {
    permission = Location.requestForegroundPermissionsAsync()
      .then((r) => r.status === 'granted')
      .catch(() => false)
  }
  return permission
}

const watchers = new Map<number, Location.LocationSubscription>()
let nextWatchId = 1

const geolocation = {
  getCurrentPosition(success: PositionCallback, error?: ErrorCallback, options: Options = {}) {
    void (async () => {
      if (!(await ensurePermission())) {
        error?.({ code: PERMISSION_DENIED, message: 'Location permission denied' })
        return
      }
      try {
        const fix = await Location.getCurrentPositionAsync({
          accuracy: options.enableHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
        })
        success(toPosition(fix))
      } catch (e) {
        error?.({ code: POSITION_UNAVAILABLE, message: e instanceof Error ? e.message : 'Location unavailable' })
      }
    })()
  },

  watchPosition(success: PositionCallback, error?: ErrorCallback, options: Options = {}): number {
    const id = nextWatchId++
    void (async () => {
      if (!(await ensurePermission())) {
        error?.({ code: PERMISSION_DENIED, message: 'Location permission denied' })
        return
      }
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: options.enableHighAccuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
            // liveTracking throttles its own Firestore writes (10s / 30m), so a steady 2s/5m stream from the OS
            // just keeps its route progress and off-route checks responsive while the caller is moving.
            timeInterval: 2_000,
            distanceInterval: 5,
          },
          (l) => success(toPosition(l)),
        )
        // clearWatch may have been called while the permission prompt / subscription was still pending.
        if (watchers.has(id)) watchers.set(id, subscription)
        else subscription.remove()
      } catch (e) {
        error?.({ code: POSITION_UNAVAILABLE, message: e instanceof Error ? e.message : 'Location unavailable' })
      }
    })()
    // Registered before the await above resolves, so clearWatch(id) is never a silent no-op.
    watchers.set(id, { remove: () => {} } as Location.LocationSubscription)
    return id
  },

  clearWatch(id: number) {
    watchers.get(id)?.remove()
    watchers.delete(id)
  },
}

// Called once from index.ts, before the app renders, so any shared code touching navigator.geolocation works.
export function installGeolocation() {
  const nav = globalThis.navigator as unknown as Record<string, unknown> | undefined
  if (!nav) return
  if (!nav.geolocation) {
    Object.defineProperty(nav, 'geolocation', { value: geolocation, configurable: true, writable: true })
  } else {
    // RN may ship a stub that throws unless a separate community package is linked — always prefer ours.
    nav.geolocation = geolocation
  }
}
