// Mirrors the Firestore `incidents` document shape in docs/quickbite_plan.md §5b.

export type Channel = 'live-call' | 'silent-tap'
export type CallState = 'active' | 'ended'
export type Severity = 'low' | 'medium' | 'high'
export type ResponseStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved'
export type FieldConfidence = 'confirmed' | 'inferred' | 'uncertain'

export interface Incident {
  id: string
  sessionStartedAt: string
  sessionEndedAt: string | null
  channel: Channel
  callState: CallState
  location: {
    rough: { lat: number; lng: number; source: 'gps' | 'ip-fallback'; capturedAt: string }
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
  response: {
    status: ResponseStatus
    acknowledgedBy: string | null
    acknowledgedAt: string | null
    resolvedAt: string | null
    notes: { responderId: string; text: string; at: string }[]
  }
}
