import { collection, doc, type Firestore } from 'firebase/firestore'
import { INCIDENTS } from '../incidents/client.ts'

// Free peer-to-peer video: WebRTC media goes phone -> dashboard directly, Firestore only carries the handshake
// (offer/answer + ICE candidates). Google's public STUN servers handle NAT discovery; there is no TURN relay
// (that costs money), so a few very strict networks may fail to connect.
export const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

// incidents/{id}/videoViewers/{viewerId}                      { offer, answer?, createdAt, viewerName }
// incidents/{id}/videoViewers/{viewerId}/viewerCandidates     ICE candidates from the dashboard
// incidents/{id}/videoViewers/{viewerId}/publisherCandidates  ICE candidates from the phone
export const viewersCollection = (db: Firestore, incidentId: string) =>
  collection(db, INCIDENTS, incidentId, 'videoViewers')

export const viewerDoc = (db: Firestore, incidentId: string, viewerId: string) =>
  doc(db, INCIDENTS, incidentId, 'videoViewers', viewerId)

export const viewerCandidates = (db: Firestore, incidentId: string, viewerId: string) =>
  collection(db, INCIDENTS, incidentId, 'videoViewers', viewerId, 'viewerCandidates')

export const publisherCandidates = (db: Firestore, incidentId: string, viewerId: string) =>
  collection(db, INCIDENTS, incidentId, 'videoViewers', viewerId, 'publisherCandidates')

export const HEARTBEAT_MS = 10_000
// A feed marked live whose heartbeat is older than this is treated as lost (sender closed or went offline).
export const HEARTBEAT_STALE_MS = 30_000

export type SessionDescription = { type: RTCSdpType; sdp: string }

export const toPlain = (d: RTCSessionDescriptionInit): SessionDescription => ({ type: d.type as RTCSdpType, sdp: d.sdp ?? '' })
