import { addDoc, doc, onSnapshot, updateDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { INCIDENTS } from '../incidents/client.ts'
import { HEARTBEAT_MS, ICE_SERVERS, publisherCandidates, toPlain, viewerCandidates, viewerDoc, viewersCollection } from './signaling.ts'

// Called by the QuickBite app with the back-camera stream. Each dashboard that opens the incident gets its own
// direct peer connection. Returns a stop function that closes every connection and marks the feed ended.
export async function startVideoPublisher(db: Firestore, incidentId: string, stream: MediaStream): Promise<() => Promise<void>> {
  const startedAt = new Date().toISOString()
  const incident = doc(db, INCIDENTS, incidentId)
  await updateDoc(incident, { video: { status: 'live', startedAt, endedAt: null, heartbeatAt: startedAt } })
  // Heartbeat lets dashboards tell a live feed from one whose sender vanished without calling stop().
  const heartbeat = setInterval(() => {
    void updateDoc(incident, { 'video.heartbeatAt': new Date().toISOString() }).catch(() => {})
  }, HEARTBEAT_MS)

  const peers = new Map<string, { pc: RTCPeerConnection; unsubscribe: Unsubscribe }>()

  const close = (viewerId: string) => {
    const peer = peers.get(viewerId)
    if (!peer) return
    peer.unsubscribe()
    peer.pc.close()
    peers.delete(viewerId)
  }

  const answerViewer = async (viewerId: string, offer: RTCSessionDescriptionInit) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    pc.onicecandidate = (e) => {
      if (e.candidate) void addDoc(publisherCandidates(db, incidentId, viewerId), e.candidate.toJSON())
    }
    await pc.setRemoteDescription(offer)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await updateDoc(viewerDoc(db, incidentId, viewerId), { answer: toPlain(answer) })
    // Remote description is set before subscribing, so viewer candidates can be applied as they arrive.
    const unsubscribe = onSnapshot(viewerCandidates(db, incidentId, viewerId), (snap) => {
      for (const c of snap.docChanges()) {
        if (c.type === 'added') pc.addIceCandidate(new RTCIceCandidate(c.doc.data())).catch(() => {})
      }
    })
    peers.set(viewerId, { pc, unsubscribe })
  }

  const unsubscribeViewers = onSnapshot(viewersCollection(db, incidentId), (snap) => {
    for (const change of snap.docChanges()) {
      const viewerId = change.doc.id
      if (change.type === 'removed') {
        close(viewerId)
        continue
      }
      const data = change.doc.data()
      // Ignore offers left over from before this feed started (e.g. a closed dashboard tab).
      if (change.type !== 'added' || !data.offer || data.answer || data.createdAt < startedAt) continue
      answerViewer(viewerId, data.offer).catch(() => close(viewerId))
    }
  })

  return async () => {
    clearInterval(heartbeat)
    unsubscribeViewers()
    ;[...peers.keys()].forEach(close)
    stream.getTracks().forEach((t) => t.stop())
    await updateDoc(incident, { 'video.status': 'ended', 'video.endedAt': new Date().toISOString() })
  }
}
