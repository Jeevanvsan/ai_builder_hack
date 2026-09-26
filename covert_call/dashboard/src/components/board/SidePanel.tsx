import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Incident } from '../../../../shared/incidents/types'
import BulletinCard from '../BulletinCard'
import CallRecordingPlayer from '../CallRecordingPlayer'
import LiveVideo from '../LiveVideo'
import NoteForm from '../NoteForm'
import ReplayScrubber from '../ReplayScrubber'
import { channelLabel } from '../../lib/format'
import Conversation from './Conversation'
import DecodeText from './DecodeText'
import SceneSketch from './SceneSketch'

type Tab = 'conversation' | 'scene' | 'case'
const SUMMARY_WAIT_MS = 90_000

// Right-hand panel: the live conversation while the call runs, the case file once it ends. It follows the call
// automatically (conversation while live, case file after), until the responder picks a tab themselves.
export default function SidePanel({ incident, live, now }: { incident: Incident; live: boolean; now: number }) {
  const [chosen, setChosen] = useState<{ tab: Tab; whileLive: boolean } | null>(null)
  const tab: Tab = chosen && chosen.whileLive === live ? chosen.tab : live ? 'conversation' : 'case'
  const pick = (t: Tab) => setChosen({ tab: t, whileLive: live })

  // Only while a feed is live — an ended feed is just a big black "feed ended" box taking the panel's space.
  const hasVideo = incident.video?.status === 'live' || incident.videoFront?.status === 'live'
  const summaryPending = !live && !incident.consolidatedSummary && incident.sessionEndedAt
    && now - Date.parse(incident.sessionEndedAt) < SUMMARY_WAIT_MS

  return (
    <aside className="side-panel">
      {hasVideo && (
        <div className="panel-video">
          <LiveVideo incident={incident} />
          <Link to={`/incident/${incident.id}/video`} className="btn btn-sm panel-video-full">Full screen</Link>
        </div>
      )}

      <div className="panel-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'conversation'} className={tab === 'conversation' ? 'active' : ''} onClick={() => pick('conversation')}>
          {live && <span className="live-dot" />}Conversation
        </button>
        <button type="button" role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? 'active' : ''} onClick={() => pick('scene')}>
          Scene
        </button>
        <button type="button" role="tab" aria-selected={tab === 'case'} className={tab === 'case' ? 'active' : ''} onClick={() => pick('case')}>
          Case file
        </button>
      </div>

      <div className="panel-body">
        {tab === 'scene' ? (
          <SceneSketch incident={incident} />
        ) : tab === 'conversation' ? (
          <Conversation
            lines={incident.transcriptLines ?? []}
            emptyText={incident.channel === 'live-call'
              ? (live ? 'Waiting for the caller to speak…' : 'No transcript was captured for this call.')
              : `${channelLabel(incident.channel)}: no spoken conversation for this incident.`}
          />
        ) : (
          <div className="case-file">
            <section className="case-section">
              <h3>Case summary</h3>
              {incident.consolidatedSummary ? (
                <>
                  <p className="case-summary"><DecodeText text={incident.consolidatedSummary} /></p>
                  {incident.leakageCheckStatus.reviewed && (
                    <p className="sub">
                      Third-party check: {incident.leakageCheckStatus.redactions.length
                        ? `redacted ${incident.leakageCheckStatus.redactions.join(', ')}`
                        : 'no redactions needed'}
                    </p>
                  )}
                </>
              ) : live ? (
                <>
                  <p className="panel-empty">AI writes the case summary when the call ends.</p>
                  <FactSheet incident={incident} />
                </>
              ) : incident.consolidationFailed ? (
                <>
                  <p className="panel-empty">The AI summary couldn't be generated for this call. Showing what was reported instead.</p>
                  <FactSheet incident={incident} />
                </>
              ) : summaryPending ? (
                <div className="evidence-searching" role="status">
                  <span className="searching-bar" />
                  <span className="searching-label">Writing the case summary…</span>
                </div>
              ) : (
                <FactSheet incident={incident} />
              )}
            </section>

            {incident.bulletin && <BulletinCard incidentId={incident.id} bulletin={incident.bulletin} />}

            {(incident.hasRecording || (incident.videoRecording?.length ?? 0) > 0 || (incident.recordingFailed && !live)) && (
              <section className="case-section">
                <h3>Evidence recordings</h3>
                {incident.hasRecording && <CallRecordingPlayer incidentId={incident.id} />}
                {!incident.hasRecording && incident.recordingFailed && !live && (
                  <p className="panel-empty">No audio recording — saving it failed ({incident.recordingFailed}).</p>
                )}
                {incident.videoRecording?.map((v) => (
                  <div key={v.camera} className="drive-row">
                    <span>{v.camera === 'front' ? 'Front camera' : 'Back camera'}</span>
                    {v.status === 'uploaded' && v.driveUrl ? (
                      <a className="btn btn-sm" href={v.driveUrl} target="_blank" rel="noreferrer">Open in Drive</a>
                    ) : (
                      <span className="sub">{v.status === 'recording' ? 'Uploading…' : 'Upload failed'}</span>
                    )}
                  </div>
                ))}
              </section>
            )}

            {!live && <ReplayScrubber incident={incident} />}

            <section className="case-section">
              <h3>Team notes</h3>
              <NoteForm incidentId={incident.id} />
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}

// Shown when no AI summary exists (e.g. a simulated or channel-only case): the reported facts, stated plainly.
function FactSheet({ incident: i }: { incident: Incident }) {
  const f = i.extractedFieldsLive
  const r = i.safeRoute
  const rows: [string, string][] = [
    ['Urgency', f.urgency ?? 'not stated'],
    ['People', f.peopleCount != null ? String(f.peopleCount) : 'not stated'],
    ['Danger', f.dangerIndicators.length ? f.dangerIndicators.join('; ') : 'none reported'],
    ['Location', i.location.confirmed?.address ?? (i.location.rough ? `approx. ${i.location.rough.lat.toFixed(4)}, ${i.location.rough.lng.toFixed(4)}` : 'unknown')],
  ]
  if (i.location.track?.length) rows.push(['Movement', `${i.location.track.length} live GPS points`])
  if (r) rows.push(['Heading to', `${r.destination.name} (${r.destination.kind}), ${(r.distanceM / 1000).toFixed(1)} km, step ${r.stepIndex + 1} of ${r.steps.length}`])
  if (i.voiceStressScore != null) rows.push(['Voice stress', String(i.voiceStressScore)])
  return (
    <dl className="fact-sheet">
      {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
    </dl>
  )
}
