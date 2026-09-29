import type { ReactNode } from 'react'
import { LINKS } from './ui'

const UPDATED = '29 September 2026'

const SECTIONS: { h: string; body: ReactNode }[] = [
  {
    h: 'Who we are',
    body: <p>Covert Call is a safety service that hides a way to ask for help inside QuickBite, an ordinary-looking food-delivery app. This policy explains what the QuickBite app (web and Android) and the responder dashboard collect, why, and who can see it. This landing page itself sets no cookies and runs no analytics or ads.</p>,
  },
  {
    h: 'What we collect, and when',
    body: (
      <>
        <p>Nothing is collected while someone simply browses the menu or places an ordinary order. Data is collected only once a person starts one of the four help paths:</p>
        <table className="pp-table">
          <thead><tr><th>Data</th><th>When</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td><b>Microphone audio</b></td><td>During a "Call to order" and during a heart double-tap SOS</td><td>For the conversation with the AI agent, understanding the situation, and voice-stress analysis</td></tr>
            <tr><td><b>Camera video</b> (back camera; front and back in SOS where the device allows)</td><td>During a call and an SOS</td><td>Live video to responders; about 1 frame per second is shared with the AI so it can understand the scene</td></tr>
            <tr><td><b>Location</b> (GPS, or an approximate IP-based location if GPS is unavailable)</td><td>When any help path starts, and while the person is moving</td><td>So responders know where to send help</td></tr>
            <tr><td><b>What the person tells or taps</b>: answers, coded menu choices, delivery instructions, notes, an address</td><td>During any help path</td><td>To build the incident report responders act on</td></tr>
            <tr><td><b>Photos</b> the person chooses to attach</td><td>Delivery instructions path only</td><td>AI reads the photo for details that help responders</td></tr>
            <tr><td><b>Responder account details</b> (name, email, actions taken)</td><td>When a responder signs in to the dashboard</td><td>Access control and a record of who handled each case</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    h: 'Permissions',
    body: (
      <ul>
        <li>The browser or phone asks for <b>microphone, camera and location</b> permission the first time a help path needs it. You can refuse or revoke these at any time in your browser or phone settings; the help paths that need them will then work with less information or not at all.</li>
        <li>The camera is <b>never shown on screen</b> during a call or SOS, so the disguise holds. Your phone's own camera and microphone indicators may still appear; the app cannot hide them, and we don't try to.</li>
        <li>In an SOS the screen turns black to look switched off. Recording continues until the SOS is ended with three taps.</li>
      </ul>
    ),
  },
  {
    h: 'How AI is used',
    body: (
      <ul>
        <li>Audio, camera frames, photos and text from a help path are processed by <b>Google's Gemini API</b> to hold the conversation, extract structured incident details, detect background sounds and estimate voice stress.</li>
        <li>A second AI check reviews each case record and <b>redacts uninvolved third parties</b> (for example a bystander's name) before responders read it.</li>
        <li>The analytics page's AI insights use only aggregated statistics, never raw recordings or personal details.</li>
        <li>AI output can be wrong. Responders see it as an aid to their judgement, not a decision.</li>
      </ul>
    ),
  },
  {
    h: 'Where data is stored and who can see it',
    body: (
      <ul>
        <li>Incident reports are stored in <b>Google Cloud Firestore</b> (region: asia-south1, Mumbai).</li>
        <li>Call and SOS video recordings are uploaded to the <b>response team's Google Drive</b>.</li>
        <li>Only <b>signed-in, authorised responders</b> can view incidents, video and recordings. Accounts are created by an administrator, and access can be disabled at any time.</li>
        <li>We do not sell data, share it with advertisers or use it for marketing. We share it with emergency services only where that is needed to get the person help.</li>
      </ul>
    ),
  },
  {
    h: 'On the phone itself',
    body: <p>The app is designed to leave no trace: ending a call, an SOS or a report returns to the ordinary home screen, and the Back button does not return to it. We do not store recordings on the device. The Android app keeps only your chosen app name and icon.</p>,
  },
  {
    h: 'How long we keep it',
    body: <p>Incident records and recordings are kept for as long as they are needed to respond, follow up and review cases, and are then deleted. Responder accounts are kept while the responder is active.</p>,
  },
  {
    h: 'Your choices',
    body: <p>You can ask us to access, correct or delete data about you. Because callers never sign in, please include enough detail (such as the approximate date, time and place) for us to find the right record. Contact us through our <a href={LINKS.github} target="_blank" rel="noreferrer">GitHub repository</a>.</p>,
  },
  {
    h: 'Children',
    body: <p>Covert Call is intended for adults. Anyone in danger may use it to ask for help. We do not knowingly collect data from children outside an emergency.</p>,
  },
  {
    h: 'Emergencies',
    body: <p>Covert Call supports, and does not replace, emergency services. If it is safe to do so, call your local emergency number.</p>,
  },
  {
    h: 'Changes',
    body: <p>If this policy changes, we will update the date at the top of this page.</p>,
  },
]

export default function Privacy() {
  return (
    <main className="pp">
      <div className="container pp-inner">
        <a href="/" className="pp-back">← Back to Covert Call</a>
        <span className="eyebrow">Legal</span>
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated {UPDATED}</p>
        <div className="pp-summary">
          <b>In short:</b> we use the microphone, cameras and location <b>only after you start a help path</b>, so responders can help you. The data goes to signed-in responders and Google's Gemini AI, is never sold, and nothing suspicious is left on your phone.
        </div>
        {SECTIONS.map((s, i) => (
          <section key={s.h} className="pp-sec">
            <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.h}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </main>
  )
}
