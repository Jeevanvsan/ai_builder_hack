// The Firestore `incidents` document shape (docs/quickbite_plan.md §5b). Shared by the QuickBite app and the dashboard.

export type Channel = 'live-call' | 'silent-tap' | 'click-order'
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
  callState: CallState
  location: {
    // null for the first moments of a call: the incident is created before location capture finishes.
    rough: RoughLocation | null
    confirmed: {
      address: string
      lat: number
      lng: number
      confidence: FieldConfidence
      confirmedAt: string
    } | null
  }
  extractedFieldsLive: {
    peopleCount: number | null
    dangerIndicators: string[]
    urgency: Severity | null
    notes: string | null
  }
  consolidatedSummary: string | null
  fieldConfidence: Record<string, FieldConfidence>
  voiceStressScore: number | null
  voiceStressTrend: { timestamp: string; score: number }[]
  leakageCheckStatus: { reviewed: boolean; redactions: string[] }
  severity: Severity
  // Present once the QuickBite app starts streaming the back camera (Epic 7.1). Absent means no video for this incident.
  video?: { status: 'live' | 'ended'; startedAt: string; endedAt: string | null; heartbeatAt?: string }
  // True once the full call recording (mic + AI voice) has been saved to the incidents/{id}/recording/audio
  // subcollection doc — kept off the main document since Firestore caps a document at 1MiB. Absent/false if
  // recording wasn't supported in the caller's browser, or the call was too long to fit in one document.
  hasRecording?: boolean
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
