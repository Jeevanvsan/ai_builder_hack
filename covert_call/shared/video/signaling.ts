import { collection, doc, type Firestore } from 'firebase/firestore'
import { INCIDENTS } from '../incidents/client.ts'

// Free peer-to-peer video: WebRTC media goes phone -> dashboard directly, Firestore only carries the handshake
// (offer/answer + ICE candidates). Google's public STUN servers handle NAT discovery; there is no TURN relay
// (that costs money), so a few very strict networks may fail to connect.
// STUN alone only tells each side its own public address; it cannot carry traffic. That is enough when the phone
// and the dashboard can reach each other directly — same Wi-Fi, or a permissive network — and it failed exactly
// as you would expect the first time the two were on different networks: "couldn't connect to the back camera
// feed", after the viewer's 20s timeout. Mobile data is the common case here, since carrier-grade NAT is
// symmetric and essentially never traversable without a relay.
//
// The TURN entries below are a fallback, not the default: ICE still prefers a direct path and only relays when
// nothing else connects. TURN relays the encrypted SRTP stream, so the relay operator cannot see the video —
// only that a stream exists, and the addresses involved.
//
// This is a free, shared, public relay with no uptime guarantee — fine for a prototype demo, and the reason the
// port-443 TCP entry is included is that it is the one most likely to survive a restrictive corporate firewall.
// Anything beyond demo use should point at a relay this project controls.
const OPEN_RELAY = { username: 'openrelayproject', credential: 'openrelayproject' }

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'turn:openrelay.metered.ca:80', ...OPEN_RELAY },
  { urls: 'turn:openrelay.metered.ca:443', ...OPEN_RELAY },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', ...OPEN_RELAY },
]

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
