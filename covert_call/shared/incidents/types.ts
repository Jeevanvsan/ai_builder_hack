// The Firestore `incidents` document shape (docs/quickbite_plan.md §5b). Shared by the QuickBite app and the dashboard.

export type Channel = 'live-call' | 'silent-tap' | 'click-order' | 'silent-sos'
export type CallState = 'active' | 'ended'
export type Severity = 'low' | 'medium' | 'high'
export type ResponseStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved'
export type FieldConfidence = 'confirmed' | 'inferred' | 'uncertain'

export interface RoughLocation {
  lat: number
  lng: number
  source: 'gps' | 'ip-fallback'
  capturedAt: string
}

export interface Incident {
  id: string
  sessionStartedAt: string
  sessionEndedAt: string | null
  channel: Channel
  // 'sos' marks an emergency raised by the silent SOS gesture (Epic 11); ordinary reports omit it or use 'report'.
  incidentType?: 'report' | 'sos'
  // Free-form scenario tag for an SOS, e.g. 'hostage' (Epic 11).
  scenario?: string
  // Which cameras the SOS captured: both at once, alternating, or back only (Epic 11.2).
  cameraMode?: 'dual' | 'alternating' | 'back-only'
  callState: CallState
  location: {
    // null for the first moments of a call: the incident is created before location capture finishes.
    rough: RoughLocation | null
    confirmed: {
      address: string
      // Null when the spoken address couldn't be geocoded at all — the text is still worth showing a responder,
      // but there is no reliable pin to route to or move the caller's map position from (see confirmAddress()).
      lat: number | null
      lng: number | null
      confidence: FieldConfidence
      confirmedAt: string
    } | null
    // Live GPS trail while the call is open (route-to-safety): lets the dashboard follow a moving caller.
    track?: { lat: number; lng: number; at: string; speed?: number | null }[]
  }
  // Route to the best-fit station (police/hospital/fire), kept current as the caller moves. Set by the AI during the
  // call or by a responder picking a station on the dashboard.
  safeRoute?: import('../nav/route.ts').SafeRoute
  extractedFieldsLive: {
    peopleCount: number | null
    dangerIndicators: string[]
    urgency: Severity | null
    notes: string | null
  }
  // Timestamped transcript lines written live during the call (Epic 17.1) — completed lines only (flushed on a
  // speaker switch or a periodic safety timer), not every raw speech-to-text fragment. Shared by the annotated
  // live transcript (17.2) and the post-call replay scrubber (17.3).
  transcriptLines?: { speaker: 'Caller' | 'Mia'; text: string; at: string }[]
  // A snapshot of extractedFieldsLive taken each time it changes (Epic 17.3) — lets the replay scrubber show only
  // the fields known as of a given point in the call, not the final picture. Capped/pruned by the writer if a
  // call runs unusually long; absent means no history was recorded (older incidents, or a very short call).
  fieldHistory?: { fields: Incident['extractedFieldsLive']; at: string }[]
  consolidatedSummary: string | null
  // Set only if the post-call consolidation pass (summary/bulletin) failed after retrying, so the dashboard can
  // say why the summary is missing instead of showing an empty state forever (Epic 3.4 bug: it used to fail
  // completely silently, with the incident stuck showing "Gemini writes the case summary..." forever).
  consolidationFailed?: boolean
  // Set only if saving the call's audio recording failed everywhere (Drive not configured/failed AND it was too
  // big for the Firestore fallback below) — same "say why instead of just missing" fix as consolidationFailed.
  recordingFailed?: string
  fieldConfidence: Record<string, FieldConfidence>
  // Live confidence per field, updated as the call progresses (Epic 16.2) — distinct from `fieldConfidence`,
  // which is only written once at consolidation. Lets the dashboard show a field sharpening from "uncertain" to
  // "confirmed" during the call itself, not just after it ends.
  fieldConfidenceLive?: Record<string, FieldConfidence>
  // Short, plain-language lines explaining why severity/urgency changed, appended whenever they actually change
  // (Epic 16.1) — not on every field write. Gives a responder a live "why", not just the resulting chip.
  reasoningTrace?: { text: string; at: string }[]
  // One derived, human-readable recommended action (Epic 16.3), computed alongside severity from the same
  // inputs — deterministic and explainable, not a separate Gemini call.
  recommendation?: string | null
  // One short, non-personal factual line (Epic 16.10) sourced via Gemini Search grounding — e.g. weather/road
  // conditions near the confirmed location. Best-effort context only; absent if grounding found nothing relevant
  // or isn't configured.
  groundedContext?: string | null
  // Other incident IDs that appear to describe the same person/vehicle/location as this one (Epic 19.1), found
  // by comparing our own recent reports — never an external identity lookup. Absent means no match was found or
  // the check wasn't run.
  correlatedIncidentIds?: string[]
  // Rigid dispatch-bulletin-style breakdown (Epic 16.4), written once at consolidation alongside the prose
  // `consolidatedSummary` — terse fragments formatted like a real dispatch broadcast, not sentences.
  bulletin?: {
    location: string
    subjects: string
    weapons: string
    vehicle: string
    status: string
    recommendedAction: string
  }
  // What the AI saw on the camera or heard in the background during the call (Epic 10) — kept separate from what
  // the caller actually said. `source` is 'camera' (a video frame) or 'sound' (a background noise like a gunshot
  // or other voices). Absent until the first observation.
  sceneObservations?: { source: 'camera' | 'sound'; kind: string; detail: string; confidence?: number | null; at: string }[]
  // Safety advice the persona gave the caller during the call (Epic 10.4), so a responder knows what they were
  // told. Absent until the first piece of advice.
  adviceGiven?: { text: string; at: string }[]
  voiceStressScore: number | null
  voiceStressTrend: { timestamp: string; score: number }[]
  leakageCheckStatus: { reviewed: boolean; redactions: string[] }
  severity: Severity
  // Present once the QuickBite app starts streaming the back camera (Epic 7.1). Absent means no video for this incident.
  video?: { status: 'live' | 'ended'; startedAt: string; endedAt: string | null; heartbeatAt?: string }
  // The front-camera live feed, only for a dual-camera SOS (Epic 11). Same shape as `video`; the dashboard shows a
  // Back/Front toggle when both are present.
  videoFront?: { status: 'live' | 'ended'; startedAt: string; endedAt: string | null; heartbeatAt?: string }
  // One entry per camera whose footage is being saved to the team Google Drive (Epic 9.2; Epic 11 records two
  // cameras for the silent SOS). Absent means no Drive recording (e.g. no camera, or the Drive upload URL isn't
  // configured). driveUrl is filled once the upload finishes.
  videoRecording?: {
    camera: 'back' | 'front'
    status: 'recording' | 'uploaded' | 'failed'
    driveFileId?: string | null
    driveUrl?: string | null
    startedAt: string
    endedAt?: string | null
  }[]
  // True once the full call recording (mic + AI voice) has been saved to the incidents/{id}/recording/audio
  // subcollection doc — kept off the main document since Firestore caps a document at 1MiB. Absent/false if
  // recording wasn't supported in the caller's browser, the call was too long to fit in one document, and Drive
  // upload (below) isn't configured or also failed.
  hasRecording?: boolean
  // The call's own audio saved to the team Google Drive (Epic 9.2's uploader, reused) — the preferred path when
  // configured, since it has no ~1MB size cap unlike the Firestore fallback above. Same shape as videoRecording.
  audioRecording?: {
    status: 'recording' | 'uploaded' | 'failed'
    driveFileId?: string | null
    driveUrl?: string | null
    startedAt: string
    endedAt?: string | null
  }
  response: {
    status: ResponseStatus
    acknowledgedBy: string | null
    acknowledgedAt: string | null
    resolvedAt: string | null
    notes: { responderId: string; text: string; at: string }[]
    // First time any responder opened the incident; until then the dashboard highlights it as new.
    viewedAt?: string | null
    viewedBy?: string | null
  }
}
