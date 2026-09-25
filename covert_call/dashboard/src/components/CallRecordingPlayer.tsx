import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { INCIDENTS } from '../../../shared/incidents/client.ts'

type RecordingDoc = { base64: string; mimeType: string }

// Recordings are saved as a base64 string in a subcollection doc (Firestore has no free-tier blob storage —
// see web/src/lib/gemini/uploadRecording.ts), so this fetches that one doc and plays it back as a data URL.
// Fetched on demand (not via the live incident listener) since it can be a few hundred KB and most responders
// won't open every recording.
export default function CallRecordingPlayer({ incidentId }: { incidentId: string }) {
  const [recording, setRecording] = useState<RecordingDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getDoc(doc(db, INCIDENTS, incidentId, 'recording', 'audio'))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) setRecording(snap.data() as RecordingDoc)
        else setError(true)
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [incidentId])

  if (loading) return <p className="muted">Loading recording…</p>
  if (error || !recording) return <p className="muted">Recording couldn't be loaded.</p>

  return (
    <audio controls src={`data:${recording.mimeType};base64,${recording.base64}`} className="recording-player">
      Your browser doesn't support audio playback.
    </audio>
  )
}
