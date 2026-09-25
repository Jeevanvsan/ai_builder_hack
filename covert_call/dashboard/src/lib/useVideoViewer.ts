import { useEffect, useState } from 'react'
import { addDoc, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import {
  HEARTBEAT_STALE_MS,
  ICE_SERVERS,
  publisherCandidates,
  toPlain,
  viewerCandidates,
  viewersCollection,
  type Camera,
} from '../../../shared/video/signaling.ts'
import type { Incident } from '../../../shared/incidents/types'
import { db } from './firebase'
import { useNow } from './useNow'

export type VideoState = 'none' | 'connecting' | 'live' | 'failed' | 'lost' | 'ended'

const CONNECT_TIMEOUT_MS = 20_000

type Connection = { key: string; state: 'live' | 'failed'; stream: MediaStream | null }

// Opens a receive-only peer connection to one of the incident's live camera feeds (`camera`, default 'back').
// Reconnects automatically when the phone starts a new feed session (new startedAt), when the responder switches
// camera, or when they hit retry.
export function useVideoViewer(incidentId: string, video: Incident['video'], viewerName: string, camera: Camera = 'back') {
  const [attempt, setAttempt] = useState(0)
  const [conn, setConn] = useState<Connection | null>(null)
  const now = useNow(5_000)

  // A feed still marked live but with a silent heartbeat means the sender vanished without stopping.
  const heartbeat = video?.heartbeatAt ?? video?.startedAt
  const lost = video?.status === 'live' && !!heartbeat && now - Date.parse(heartbeat) > HEARTBEAT_STALE_MS
  const live = video?.status === 'live' && !lost
  const key = `${incidentId}|${camera}|${video?.startedAt ?? ''}|${attempt}`

  useEffect(() => {
    if (!live) return
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.addTransceiver('video', { direction: 'recvonly' })
    const viewerRef = doc(viewersCollection(db, incidentId, camera))
    const pending: RTCIceCandidateInit[] = []
    const unsubscribers: (() => void)[] = []
    let remote: MediaStream | null = null

    // Only report live once media can actually flow, not merely when the answer (and track) arrives.
    const reportIfConnected = () => {
      if (pc.connectionState === 'connected' && remote) setConn({ key, state: 'live', stream: remote })
    }
    const fail = () => setConn({ key, state: 'failed', stream: null })

    pc.onicecandidate = (e) => {
      if (e.candidate) void addDoc(viewerCandidates(db, incidentId, viewerRef.id, camera), e.candidate.toJSON())
    }
    pc.ontrack = (e) => {
      remote = e.streams[0] ?? new MediaStream([e.track])
      reportIfConnected()
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') reportIfConnected()
      else if (pc.connectionState === 'failed') fail()
    }
    const timeout = setTimeout(() => {
      if (pc.connectionState !== 'connected') fail()
    }, CONNECT_TIMEOUT_MS)

    void (async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await setDoc(viewerRef, { offer: toPlain(offer), createdAt: new Date().toISOString(), viewerName: viewerName || null })
        unsubscribers.push(
          onSnapshot(viewerRef, async (snap) => {
            const answer = snap.data()?.answer
            if (!answer || pc.currentRemoteDescription) return
            await pc.setRemoteDescription(answer)
            // Candidates that arrived before the answer are buffered, then applied once it's in place.
            pending.splice(0).forEach((c) => pc.addIceCandidate(c).catch(() => {}))
          }),
          onSnapshot(publisherCandidates(db, incidentId, viewerRef.id, camera), (snap) => {
            for (const c of snap.docChanges()) {
              if (c.type !== 'added') continue
              const candidate = c.doc.data() as RTCIceCandidateInit
              if (pc.currentRemoteDescription) pc.addIceCandidate(candidate).catch(() => {})
              else pending.push(candidate)
            }
          }),
        )
      } catch {
        fail()
      }
    })()

    return () => {
      clearTimeout(timeout)
      unsubscribers.forEach((u) => u())
      pc.close()
      void deleteDoc(viewerRef).catch(() => {})
    }
    // viewerName is only a label on the handshake doc; changing it shouldn't drop a live feed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live])

  const state: VideoState = !video
    ? 'none'
    : lost
      ? 'lost'
      : !live
        ? 'ended'
        : conn?.key === key
          ? conn.state
          : 'connecting'

  return { state, stream: state === 'live' ? conn?.stream ?? null : null, retry: () => setAttempt((a) => a + 1) }
}
