import { collection, doc, type Firestore } from 'firebase/firestore'
import { INCIDENTS } from '../incidents/client.ts'

// Free peer-to-peer video: WebRTC media goes phone -> dashboard directly, Firestore only carries the handshake
// (offer/answer + ICE candidates). Google's public STUN servers handle NAT discovery; there is no TURN relay
// (that costs money), so a few very strict networks may fail to connect.
// STUN alone only tells each side its own public address; it cannot carry traffic. That is enough when the phone
// and the dashboard can reach each other directly — same Wi-Fi, or a permissive network — and it fails exactly
// as you would expect once they are on different networks: "couldn't connect to the back camera feed", after
// the viewer's 20s timeout. Mobile data makes it near-certain, since carrier-grade NAT is symmetric and
// essentially never traversable without a relay.
//
// Relaying needs TURN, and TURN needs credentials. They are injected by each app from its own environment
// rather than written here, because this repository is public and committed credentials would be scraped and
// the quota drained. Without them the app still runs — it just can't relay, which is the behaviour above.
//
// A relay only ever carries encrypted SRTP, so the operator cannot see the video: only that a stream exists and
// the addresses involved. ICE still prefers a direct path and falls back to the relay solely when nothing else
// connects, so adding TURN costs nothing on networks that never need it.
const STUN_ONLY: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

let iceServers: RTCIceServer[] = STUN_ONLY

/**
 * Called once at startup by each app (web, native, dashboard) with credentials from its own environment.
 * Passing nothing, or a blank url, leaves the app on STUN only rather than failing — a missing relay should
 * degrade the video feed, never stop a call or an SOS from running.
 *
 * Both UDP and TCP/443 entries are registered for the same host: port 443 over TCP is the variant most likely
 * to survive a restrictive corporate firewall, which is the case this exists for.
 */
export function configureTurn(turn?: { url?: string; username?: string; credential?: string }): void {
  const url = turn?.url?.trim()
  if (!url || !turn?.username || !turn?.credential) {
    iceServers = STUN_ONLY
    return
  }

  const auth = { username: turn.username, credential: turn.credential }
  const tcp = url.includes('?transport=') ? [] : [{ urls: `${url}?transport=tcp`, ...auth }]
  iceServers = [...STUN_ONLY, { urls: url, ...auth }, ...tcp]
}

export function getIceServers(): RTCIceServer[] {
  return iceServers
}

// A single incident can carry several live feeds at once (Epic 11: front + back cameras; a live listen-in
// audio channel), so each gets its own signaling collection and its own status field on the incident. 'back'
// keeps the original names, so the existing single-camera call path (Epic 9) is completely unchanged.
// 'mic' is the caller's raw microphone audio, published one-way for a responder to listen in live (never sent
// back to the caller — that's a separate two-way takeover channel, not this one).
export type Camera = 'back' | 'front' | 'mic'

// Which incident field holds a channel's live status.
export const videoField = (camera: Camera = 'back'): 'video' | 'videoFront' | 'audioListen' =>
  camera === 'front' ? 'videoFront' : camera === 'mic' ? 'audioListen' : 'video'

const viewersName = (camera: Camera): string => (camera === 'front' ? 'videoViewersFront' : camera === 'mic' ? 'audioViewers' : 'videoViewers')

// incidents/{id}/{videoViewers|videoViewersFront}/{viewerId}                      { offer, answer?, createdAt, viewerName }
// incidents/{id}/.../{viewerId}/viewerCandidates     ICE candidates from the dashboard
// incidents/{id}/.../{viewerId}/publisherCandidates  ICE candidates from the phone
export const viewersCollection = (db: Firestore, incidentId: string, camera: Camera = 'back') =>
  collection(db, INCIDENTS, incidentId, viewersName(camera))

export const viewerDoc = (db: Firestore, incidentId: string, viewerId: string, camera: Camera = 'back') =>
  doc(db, INCIDENTS, incidentId, viewersName(camera), viewerId)

export const viewerCandidates = (db: Firestore, incidentId: string, viewerId: string, camera: Camera = 'back') =>
  collection(db, INCIDENTS, incidentId, viewersName(camera), viewerId, 'viewerCandidates')

export const publisherCandidates = (db: Firestore, incidentId: string, viewerId: string, camera: Camera = 'back') =>
  collection(db, INCIDENTS, incidentId, viewersName(camera), viewerId, 'publisherCandidates')

export const HEARTBEAT_MS = 10_000
// A feed marked live whose heartbeat is older than this is treated as lost (sender closed or went offline).
export const HEARTBEAT_STALE_MS = 30_000

export type SessionDescription = { type: RTCSdpType; sdp: string }

export const toPlain = (d: RTCSessionDescriptionInit): SessionDescription => ({ type: d.type as RTCSdpType, sdp: d.sdp ?? '' })
