// Google Maps Platform web services: Places API (New) Text Search and Nearby Search, and Routes API computeRoutes.
// Called straight from the caller's phone (web and native), the dashboard and the eval (Node); both allow browser
// CORS and website-restricted keys (checked 2026-11-20). The older Geocoding API is not used: it refuses keys with
// website restrictions, and Places Text Search covers addresses. Each app calls setGoogleMaps() once at startup with
// its own key. With no key every helper returns null at once, and the callers keep their OpenStreetMap path.

export type GoogleMapsConfig = {
  key: string
  // Headers a key's restriction needs outside a browser: the eval (Node) sends a Referer from the key's website
  // list; the Android app sends X-Android-Package and X-Android-Cert for an app-restricted key.
  headers?: Record<string, string>
}

let config: GoogleMapsConfig | null = null
export function setGoogleMaps(c: GoogleMapsConfig | null | undefined) {
  config = c?.key ? c : null
}
export const googleMapsEnabled = () => config !== null

type LatLng = { lat: number; lng: number }
const TIMEOUT_MS = 5_000

// One request with the key, a short timeout and quiet failure (null): a slow or refused Google request must fall
// back to the free path, never hold up Mia's next line. The key never appears in a log line.
async function request<T>(url: string, body: unknown, fieldMask: string): Promise<T | null> {
  if (!config) return null
  const headers: Record<string, string> = { ...config.headers, 'X-Goog-Api-Key': config.key, 'X-Goog-FieldMask': fieldMask, 'Content-Type': 'application/json' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
    if (!res.ok) {
      console.warn('[maps]', url, res.status)
      return null
    }
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const latLng = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng })

// ---- Places API (New) ----

export type Place = { id: string; name: string; address: string | null; lat: number; lng: number; types: string[]; phone: string | null }

type PlacesResponse = {
  places?: {
    id: string
    displayName?: { text?: string }
    formattedAddress?: string
    location?: { latitude: number; longitude: number }
    types?: string[]
    businessStatus?: string
    nationalPhoneNumber?: string
    internationalPhoneNumber?: string
  }[]
}

// Closed places are dropped: a shop wrongly tagged as a fire station 10 m from the caller was "temporarily closed".
const toPlaces = (data: PlacesResponse): Place[] =>
  (data.places ?? []).flatMap((p) => p.location && (!p.businessStatus || p.businessStatus === 'OPERATIONAL')
    ? [{
        id: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? null,
        lat: p.location.latitude,
        lng: p.location.longitude,
        types: p.types ?? [],
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
      }]
    : [])

// Name, address, position and types: the Text/Nearby Search "Pro" fields. Phone numbers are "Enterprise" fields
// (a smaller free allowance), so they are asked for only where a responder needs to call the place.
const PLACE_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus'
const PHONE_FIELDS = ',places.nationalPhoneNumber,places.internationalPhoneNumber'

export type Box = { south: number; west: number; north: number; east: number }
export const boxAround = (p: LatLng, d: number): Box => ({ south: p.lat - d, west: p.lng - d, north: p.lat + d, east: p.lng + d })

// Free-text place search ("St George Auditorium", "Asha Nivas, Vazhicherry, Alappuzha"). `near` biases the results
// towards a point; `within` keeps them inside a box. Null when Google is off or unreachable; [] when nothing matched.
export async function placesTextSearch(query: string, opts: { near?: LatLng | null; radiusM?: number; within?: Box; max?: number } = {}): Promise<Place[] | null> {
  const body: Record<string, unknown> = { textQuery: query, pageSize: opts.max ?? 5 }
  if (opts.within) {
    body.locationRestriction = { rectangle: { low: { latitude: opts.within.south, longitude: opts.within.west }, high: { latitude: opts.within.north, longitude: opts.within.east } } }
  } else if (opts.near) {
    body.locationBias = { circle: { center: latLng(opts.near), radius: Math.min(50_000, opts.radiusM ?? 10_000) } }
  }
  const data = await request<PlacesResponse>('https://places.googleapis.com/v1/places:searchText', body, PLACE_FIELDS)
  return data ? toPlaces(data) : null
}

// Places of the given types (Places "Table A" types, e.g. police, fire_station, hospital) within radiusM of a point.
// With no types, any kind of place. `prominent` asks for the best-known places whose main type is one of `types`,
// instead of simply the nearest of any place carrying the type: nearest-first gave a traffic police cabin as "police",
// a visa medical agency as "hospital" and a mis-tagged shop as "fire station". Null when Google is off or unreachable.
export async function placesNearby(center: LatLng, radiusM: number, types: string[], opts: { max?: number; withPhone?: boolean; prominent?: boolean } = {}): Promise<Place[] | null> {
  const body: Record<string, unknown> = {
    maxResultCount: Math.min(20, opts.max ?? 10),
    rankPreference: opts.prominent ? 'POPULARITY' : 'DISTANCE',
    locationRestriction: { circle: { center: latLng(center), radius: Math.min(50_000, radiusM) } },
  }
  if (types.length) body[opts.prominent ? 'includedPrimaryTypes' : 'includedTypes'] = types
  const data = await request<PlacesResponse>('https://places.googleapis.com/v1/places:searchNearby', body, PLACE_FIELDS + (opts.withPhone ? PHONE_FIELDS : ''))
  return data ? toPlaces(data) : null
}

// ---- Routes API ----

export type TravelMode = 'WALK' | 'TWO_WHEELER' | 'DRIVE'
export type GoogleRoute = {
  distanceM: number
  durationS: number
  geometry: LatLng[]
  steps: { instruction: string; distanceM: number; lat: number; lng: number }[]
}

type RoutesResponse = {
  routes?: {
    distanceMeters?: number
    duration?: string
    polyline?: { geoJsonLinestring?: { coordinates?: [number, number][] } }
    legs?: {
      steps?: {
        distanceMeters?: number
        startLocation?: { latLng?: { latitude: number; longitude: number } }
        navigationInstruction?: { maneuver?: string; instructions?: string }
      }[]
    }[]
  }[]
}

const ROUTE_FIELDS = [
  'routes.distanceMeters', 'routes.duration', 'routes.polyline.geoJsonLinestring',
  'routes.legs.steps.distanceMeters', 'routes.legs.steps.startLocation', 'routes.legs.steps.navigationInstruction',
].join(',')

// A route for walking, a two-wheeler or a car, with spoken-style turn instructions. Each step is placed where its
// manoeuvre happens, and an arrival step is added at the end, the same shape as the OSRM route it replaces.
// Traffic-unaware (the cheaper "Essentials" request).
export async function computeRoute(from: LatLng, to: LatLng, mode: TravelMode): Promise<GoogleRoute | null> {
  const body = {
    origin: { location: { latLng: latLng(from) } },
    destination: { location: { latLng: latLng(to) } },
    travelMode: mode,
    ...(mode === 'WALK' ? {} : { routingPreference: 'TRAFFIC_UNAWARE' }),
    polylineEncoding: 'GEO_JSON_LINESTRING',
    computeAlternativeRoutes: false,
    languageCode: 'en',
    units: 'METRIC',
  }
  const data = await request<RoutesResponse>('https://routes.googleapis.com/directions/v2:computeRoutes', body, ROUTE_FIELDS)
  const r = data?.routes?.[0]
  const coords = r?.polyline?.geoJsonLinestring?.coordinates
  if (!r || !coords?.length) return null
  const steps = (r.legs?.[0]?.steps ?? []).flatMap((s) => {
    const at = s.startLocation?.latLng
    if (!at) return []
    // Extra notes come on new lines ("Turn left\nRestricted usage road").
    const instruction = (s.navigationInstruction?.instructions ?? '').replace(/\s*\n\s*/g, '. ').trim() || 'Continue'
    return [{ instruction, distanceM: Math.round(s.distanceMeters ?? 0), lat: at.latitude, lng: at.longitude }]
  })
  const [endLng, endLat] = coords[coords.length - 1]
  steps.push({ instruction: 'Arrive at the destination', distanceM: 0, lat: endLat, lng: endLng })
  return {
    distanceM: Math.round(r.distanceMeters ?? 0),
    durationS: Math.round(parseFloat(r.duration ?? '0')),
    // Firestore rejects nested arrays, so the line is stored as {lat, lng} points.
    geometry: coords.map(([lng, lat]) => ({ lat, lng })),
    steps,
  }
}

// Area-sized Places results (a whole town, district, pincode): a real match, but not a point to send help to.
const AREA_TYPES = new Set([
  'locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'neighborhood', 'postal_code', 'political',
  'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'country', 'colloquial_area', 'route',
])
export const isAreaPlace = (p: Place) => p.types.length > 0 && p.types.every((t) => AREA_TYPES.has(t))
