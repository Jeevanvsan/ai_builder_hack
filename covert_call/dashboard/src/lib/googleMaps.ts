// The dashboard's Google Maps key (Maps JavaScript API, which includes Street View and 3D Maps). It is public in the
// bundle, so in Google Cloud it is restricted to the dashboard's own sites. Without it the dashboard falls back to
// OpenStreetMap, and the Satellite, 3D and Street views are hidden.
export const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// The muted "board" look comes from the cloud map style attached to this Map ID. Without one, Google's demo ID shows
// the default style. Advanced markers need a Map ID either way.
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
