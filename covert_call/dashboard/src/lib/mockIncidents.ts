import type { Incident } from './types'

// Static fixtures until the real-time channel from Epic 3 exists. Timestamps are relative to page load so the queue looks live.
const loadedAt = Date.now()
const minsAgo = (m: number) => new Date(loadedAt - m * 60_000).toISOString()

type Overrides = Partial<Omit<Incident, 'extractedFieldsLive' | 'response'>> & {
  extractedFieldsLive?: Partial<Incident['extractedFieldsLive']>
  response?: Partial<Incident['response']>
}

function incident(id: string, startedMinsAgo: number, o: Overrides): Incident {
  const startedAt = minsAgo(startedMinsAgo)
  return {
    id,
    sessionStartedAt: startedAt,
    sessionEndedAt: null,
    channel: 'live-call',
    callState: 'active',
    location: {
      rough: { lat: 12.9716, lng: 77.5946, source: 'gps', capturedAt: startedAt },
      confirmed: null,
    },
    consolidatedSummary: null,
    fieldConfidence: {},
    voiceStressScore: null,
    voiceStressTrend: [],
    leakageCheckStatus: { reviewed: false, redactions: [] },
    severity: 'medium',
    ...o,
    extractedFieldsLive: {
      peopleCount: null,
      dangerIndicators: [],
      urgency: null,
      notes: null,
      ...o.extractedFieldsLive,
    },
    response: {
      status: 'new',
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedAt: null,
      notes: [],
      ...o.response,
    },
  }
}

export const mockIncidents: Incident[] = [
  incident('INC-1048', 2, {
    severity: 'high',
    voiceStressScore: 82,
    extractedFieldsLive: { peopleCount: 2, dangerIndicators: ['weapon mentioned'], urgency: 'high' },
  }),
  incident('INC-1046', 9, {
    severity: 'high',
    voiceStressScore: 71,
    location: {
      rough: { lat: 12.9352, lng: 77.6245, source: 'gps', capturedAt: minsAgo(9) },
      confirmed: {
        address: '4th Cross, Koramangala, Bengaluru',
        lat: 12.9352,
        lng: 77.6245,
        confidence: 'confirmed',
        confirmedAt: minsAgo(6),
      },
    },
    extractedFieldsLive: { peopleCount: 3, dangerIndicators: ['injury', 'aggressor present'], urgency: 'high' },
    response: { status: 'acknowledged', acknowledgedBy: 'Responder A', acknowledgedAt: minsAgo(8) },
  }),
  incident('INC-1045', 5, {
    channel: 'silent-tap',
    severity: 'medium',
    location: {
      rough: { lat: 12.9141, lng: 77.6101, source: 'ip-fallback', capturedAt: minsAgo(5) },
      confirmed: null,
    },
    extractedFieldsLive: { peopleCount: 1, urgency: 'medium', notes: 'Rider note: "please hurry"' },
  }),
  incident('INC-1044', 1, {
    severity: 'low',
    voiceStressScore: 34,
    extractedFieldsLive: { peopleCount: 1, urgency: 'low' },
  }),
  incident('INC-1043', 25, {
    callState: 'ended',
    sessionEndedAt: minsAgo(20),
    severity: 'medium',
    voiceStressScore: 58,
    location: {
      rough: { lat: 12.9784, lng: 77.6408, source: 'gps', capturedAt: minsAgo(25) },
      confirmed: {
        address: '100 Feet Road, Indiranagar, Bengaluru',
        lat: 12.9784,
        lng: 77.6408,
        confidence: 'confirmed',
        confirmedAt: minsAgo(23),
      },
    },
    extractedFieldsLive: { peopleCount: 2, dangerIndicators: ['injury'], urgency: 'medium' },
    consolidatedSummary:
      'Caller reported one injured person and one other present at a residence in Indiranagar. No weapon indicated. Address confirmed in conversation.',
    fieldConfidence: { peopleCount: 'confirmed', dangerIndicators: 'inferred', urgency: 'confirmed' },
    leakageCheckStatus: { reviewed: true, redactions: ['neighbour name'] },
    response: { status: 'in_progress', acknowledgedBy: 'Responder B', acknowledgedAt: minsAgo(22) },
  }),
  incident('INC-1040', 40, {
    channel: 'silent-tap',
    callState: 'ended',
    sessionEndedAt: minsAgo(38),
    severity: 'low',
    extractedFieldsLive: { peopleCount: 1, urgency: 'low' },
    response: { status: 'acknowledged', acknowledgedBy: 'Responder A', acknowledgedAt: minsAgo(36) },
  }),
  incident('INC-1037', 190, {
    callState: 'ended',
    sessionEndedAt: minsAgo(185),
    severity: 'medium',
    voiceStressScore: 54,
    location: {
      rough: { lat: 12.9698, lng: 77.75, source: 'gps', capturedAt: minsAgo(190) },
      confirmed: {
        address: 'ITPL Main Road, Whitefield, Bengaluru',
        lat: 12.9698,
        lng: 77.75,
        confidence: 'confirmed',
        confirmedAt: minsAgo(188),
      },
    },
    extractedFieldsLive: { peopleCount: 2, dangerIndicators: ['injury'], urgency: 'medium' },
    consolidatedSummary: 'One person injured at a residence in Whitefield; caller safe once responders arrived.',
    response: {
      status: 'resolved',
      acknowledgedBy: 'Responder B',
      acknowledgedAt: minsAgo(189),
      resolvedAt: minsAgo(150),
    },
  }),
  incident('INC-1031', 1500, {
    callState: 'ended',
    sessionEndedAt: minsAgo(1494),
    severity: 'high',
    voiceStressScore: 88,
    extractedFieldsLive: { peopleCount: 4, dangerIndicators: ['weapon mentioned'], urgency: 'high' },
    consolidatedSummary: 'Weapon reported during a dispute involving four people; situation de-escalated on arrival.',
    response: {
      status: 'resolved',
      acknowledgedBy: 'Responder A',
      acknowledgedAt: minsAgo(1499),
      resolvedAt: minsAgo(1420),
    },
  }),
]
