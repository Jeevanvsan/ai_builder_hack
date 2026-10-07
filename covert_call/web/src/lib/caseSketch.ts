import type { Incident } from '../../../shared/incidents/types.ts'

// The case report's scene sketch: an OpenStreetMap map of the incident with where the caller started, the address
// they gave, their movement trail, the route to safety and the destination. Drawn in the caller's browser when the
// call ends (no map service can do it for free on the server) and saved with the camera snaps for the email/PDF.
type P = { lat: number; lng: number }
const TILE = 256
const W = 900
const H = 600
const KIND_COLOUR: Record<string, string> = { police: '#1d4ed8', hospital: '#15803d', fire: '#dc2626' }

function project(p: P, z: number) {
  const size = TILE * 2 ** z
  const sin = Math.sin((p.lat * Math.PI) / 180)
  return { x: ((p.lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size }
}

function distanceKm(a: P, b: P) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 5_000)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); resolve(null) }
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  })
}

// Base64 JPEG (no data: prefix), or null when the incident has no position at all.
export async function buildCaseSketch(id: string, i: Omit<Incident, 'id'>): Promise<string | null> {
  const route = i.safeRoute
  const c = i.location.confirmed
  const pinned = c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null
  // The sketch is centred on the incident: the address and the route. A phone fix far from them (a laptop's IP or
  // Wi-Fi position tens of km away) zoomed the map out to a whole district, INC-MUWMRXPL. Such points are left off
  // the map and mentioned in a note instead.
  const anchor = pinned ?? route?.geometry[0] ?? null
  const near = (p: P) => !anchor || distanceKm(anchor, p) <= 3
  const allTrack = i.location.track ?? []
  const track = allTrack.filter(near)
  const startRaw = i.location.rough ?? allTrack[0] ?? null
  const start = startRaw && near(startRaw) ? startRaw : null
  const startFar = startRaw && !start ? distanceKm(anchor!, startRaw) : null
  const pts: P[] = [...(route?.geometry ?? []), ...track, ...(pinned ? [pinned] : []), ...(route ? [route.destination] : []), ...(start ? [start] : [])]
  if (!pts.length) return null

  // The closest zoom at which everything fits with room for labels.
  let z = 17
  for (; z > 3; z--) {
    const ps = pts.map((p) => project(p, z))
    const w = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x))
    const h = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y))
    if (w < W - 220 && h < H - 200) break
  }
  const ps = pts.map((p) => project(p, z))
  const cx = (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2
  const cy = (Math.max(...ps.map((p) => p.y)) + Math.min(...ps.map((p) => p.y))) / 2
  const ox = cx - W / 2
  const oy = cy - H / 2 + 20
  const at = (p: P) => { const q = project(p, z); return { x: q.x - ox, y: q.y - oy } }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#eef0f2'
  ctx.fillRect(0, 0, W, H)

  // Map tiles.
  const jobs: Promise<void>[] = []
  for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + W) / TILE); tx++) {
    for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + H) / TILE); ty++) {
      jobs.push(loadTile(z, tx, ty).then((img) => { if (img) ctx.drawImage(img, tx * TILE - ox, ty * TILE - oy) }))
    }
  }
  await Promise.all(jobs)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(0, 0, W, H)

  const line = (path: P[], colour: string, width: number, dash: number[] = []) => {
    if (path.length < 2) return
    ctx.beginPath()
    path.forEach((p, k) => { const q = at(p); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y) })
    ctx.setLineDash(dash)
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.setLineDash([])
  }
  const label = (text: string, x: number, y: number, colour: string) => {
    ctx.font = 'bold 14px Arial'
    const w = ctx.measureText(text).width + 12
    const lx = Math.min(Math.max(4, x + 12), W - w - 4)
    const ly = Math.min(Math.max(48, y - 12), H - 26)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.fillRect(lx, ly, w, 22)
    ctx.strokeStyle = colour
    ctx.lineWidth = 1.5
    ctx.strokeRect(lx, ly, w, 22)
    ctx.fillStyle = '#111'
    ctx.fillText(text, lx + 6, ly + 16)
  }
  const dot = (p: P, colour: string, r: number) => {
    const q = at(p)
    ctx.beginPath()
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2)
    ctx.fillStyle = colour
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff'
    ctx.stroke()
    return q
  }

  // Route (white casing under blue), then the caller's trail (dashed), then the points.
  if (route) {
    line(route.geometry, '#ffffff', 10)
    line(route.geometry, '#1a73e8', 6)
  }
  line(track, '#7c3aed', 3, [6, 6])
  if (start) { const q = dot(start, '#6b7280', 7); label('Call started here', q.x, q.y, '#6b7280') }
  if (track.length > 1) { const q = dot(track[track.length - 1], '#7c3aed', 7); label('Last known position', q.x, q.y, '#7c3aed') }
  if (pinned && c) { const q = dot(pinned, '#dc2626', 10); label(`Caller: ${c.address}`.slice(0, 60), q.x, q.y, '#dc2626') }
  if (route) {
    const colour = KIND_COLOUR[route.destination.kind] ?? '#1d4ed8'
    const q = dot(route.destination, colour, 11)
    label(`Safe place: ${route.destination.name}`.slice(0, 60), q.x, q.y, colour)
  }

  // Title and legend.
  ctx.fillStyle = 'rgba(17,24,39,0.88)'
  ctx.fillRect(0, 0, W, 38)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px Arial'
  ctx.fillText(`QuickBite case ${id}: map`, 12, 25)
  ctx.font = '12px Arial'
  const legend = `${route ? `Route ${Math.round(route.distanceM)} m to ${route.destination.kind}` : 'No route'}${track.length ? ` · trail ${track.length} points` : ''}`
  ctx.fillText(legend, W - ctx.measureText(legend).width - 12, 24)
  if (startFar != null) {
    const note = `Phone's own location at the start was ${Math.round(startFar)} km away (approximate) and is not shown`
    ctx.font = '12px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillRect(0, H - 18, ctx.measureText(note).width + 16, 18)
    ctx.fillStyle = '#444'
    ctx.fillText(note, 8, H - 5)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(W - 190, H - 18, 190, 18)
  ctx.fillStyle = '#333'
  ctx.font = '11px Arial'
  ctx.fillText('© OpenStreetMap contributors', W - 182, H - 5)

  try {
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? null
  } catch {
    return null // a tile without CORS would taint the canvas
  }
}
