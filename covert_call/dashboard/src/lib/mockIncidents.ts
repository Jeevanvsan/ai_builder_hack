import type { Incident } from '../../../shared/incidents/types'

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
      // Seeded incidents count as already seen, so only genuinely new calls get highlighted.
      viewedAt: startedAt,
      viewedBy: null,
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
  incident('INC-1035', 330, {
    channel: 'silent-tap',
    callState: 'ended',
    sessionEndedAt: minsAgo(327),
    severity: 'high',
    location: {
      rough: { lat: 12.9166, lng: 77.6101, source: 'gps', capturedAt: minsAgo(330) },
      confirmed: { address: 'BTM Layout 2nd Stage, Bengaluru', lat: 12.9166, lng: 77.6101, confidence: 'inferred', confirmedAt: minsAgo(328) },
    },
    extractedFieldsLive: { peopleCount: 1, dangerIndicators: ['aggressor present'], urgency: 'high', notes: 'Rider note: "he is still here"' },
    consolidatedSummary: 'Silent report from BTM Layout: caller alone with an aggressor present, unable to speak. Location inferred from rider note and GPS.',
    response: { status: 'resolved', acknowledgedBy: 'Responder C', acknowledgedAt: minsAgo(329), resolvedAt: minsAgo(290) },
  }),
  incident('INC-1029', 2900, {
    callState: 'ended',
    sessionEndedAt: minsAgo(2893),
    severity: 'low',
    voiceStressScore: 31,
    location: {
      rough: { lat: 13.0358, lng: 77.597, source: 'gps', capturedAt: minsAgo(2900) },
      confirmed: { address: 'Hebbal Kempapura, Bengaluru', lat: 13.0358, lng: 77.597, confidence: 'confirmed', confirmedAt: minsAgo(2897) },
    },
    extractedFieldsLive: { peopleCount: 1, urgency: 'low' },
    consolidatedSummary: 'Caller felt unsafe walking home in Hebbal and stayed on the line until reaching home. No danger indicators.',
    response: { status: 'resolved', acknowledgedBy: 'Responder B', acknowledgedAt: minsAgo(2899), resolvedAt: minsAgo(2880) },
  }),
  incident('INC-1022', 6200, {
    callState: 'ended',
    sessionEndedAt: minsAgo(6192),
    severity: 'medium',
    voiceStressScore: 63,
    location: {
      rough: { lat: 12.9259, lng: 77.5838, source: 'gps', capturedAt: minsAgo(6200) },
      confirmed: { address: 'Jayanagar 4th Block, Bengaluru', lat: 12.9259, lng: 77.5838, confidence: 'confirmed', confirmedAt: minsAgo(6196) },
    },
    extractedFieldsLive: { peopleCount: 3, dangerIndicators: ['injury'], urgency: 'medium' },
    consolidatedSummary: 'Domestic incident in Jayanagar with one minor injury; three people present. Caller safe after responders arrived.',
    leakageCheckStatus: { reviewed: true, redactions: ["child's name"] },
    response: { status: 'resolved', acknowledgedBy: 'Responder A', acknowledgedAt: minsAgo(6199), resolvedAt: minsAgo(6130) },
  }),
  incident('INC-1014', 14500, {
    channel: 'silent-tap',
    callState: 'ended',
    sessionEndedAt: minsAgo(14496),
    severity: 'medium',
    location: {
      rough: { lat: 12.9591, lng: 77.6974, source: 'ip-fallback', capturedAt: minsAgo(14500) },
      confirmed: null,
    },
    extractedFieldsLive: { peopleCount: 2, urgency: 'medium' },
    consolidatedSummary: 'Silent report near Marathahalli; address never confirmed. Responders located the caller from the approximate location.',
    response: { status: 'resolved', acknowledgedBy: 'Responder C', acknowledgedAt: minsAgo(14498), resolvedAt: minsAgo(14420) },
  }),
]
