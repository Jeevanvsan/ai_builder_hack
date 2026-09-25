export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function statusLabel(status: string): string {
  return status.replace('_', ' ')
}

// How each incident channel reads to a responder. Kept in one place so every view (queue, detail, history,
// alerts, timeline) labels a channel the same way, including the Epic 8 "click & order" path.
export function channelLabel(channel: string): string {
  switch (channel) {
    case 'live-call':
      return 'Voice call'
    case 'silent-tap':
      return 'Silent tap'
    case 'click-order':
      return 'Coded order'
    case 'silent-sos':
      return 'Silent SOS'
    default:
      return channel
  }
}

export function formatElapsed(fromIso: string, now: number): string {
  const total = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function timeAgo(iso: string, now: number): string {
  const mins = Math.floor((now - Date.parse(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}
