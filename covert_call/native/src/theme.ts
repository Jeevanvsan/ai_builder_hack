// Design tokens mirroring web/src/styles/tokens.css, so the phone app and the browser app look like the same
// product. Keep the two in sync — a caller who has seen one and then uses the other shouldn't notice a change.
export const colors = {
  surface: '#fff8ef',
  card: '#ffffff',
  backdrop: '#efe7da',
  ink: '#1c1a16',
  ink2: '#3d3830',
  muted: '#8a806e',
  line: '#eee3d2',
  lineStrong: '#e1d6c3',

  accent: '#e0631f',
  accentDark: '#c4521a',
  accentSoft: '#fdeee3',

  veg: '#2e8b57',
  nonveg: '#b3261e',
  rating: '#2e8b57',
  bestseller: '#d9480f',
  free: '#2e8b57',

  // The call screen is the one deliberately dark surface, matching a phone's native in-call UI.
  callBg: '#151315',
  callInk: '#f4efe6',
  callMuted: '#a89f8c',
  callBtn: '#2c2926',
  callEnd: '#d93a2b',

  danger: '#b3261e',
}

export const radius = { sm: 8, md: 12, lg: 18 }

// React Native has no box-shadow; this is the elevation equivalent of the web's --shadow-card.
export const shadowCard = {
  shadowColor: '#3c280a',
  shadowOpacity: 0.12,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
}

export const shadowBar = {
  shadowColor: '#3c280a',
  shadowOpacity: 0.18,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: -4 },
  elevation: 12,
}
