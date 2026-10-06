// QuickBite Apps Script (paste this WHOLE file over Code.gs, then Deploy → Manage deployments → edit → New version).
// 1. Trusted-contact alert: emails the caller's trusted contacts when their call turns high severity.
// 2. Case report: after a danger call, emails the caller the case report at the address saved on the incident.
const PROJECT = 'quickbite-5cde0'
const MAX_RECIPIENTS = 3
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const id = String(body.incidentId || '')
    if (!/^INC-[A-Za-z0-9-]{2,32}$/.test(id)) return out({ ok: false, error: 'bad id' })
    if (body.type === 'case_report') return caseReport(id)
    return trustedAlert(id, body)
  } catch (err) {
    return out({ ok: false, error: String(err) })
  }
}

function readIncident(id) {
  const res = UrlFetchApp.fetch(
    'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/incidents/' + id,
    { muteHttpExceptions: true },
  )
  return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()).fields || {} : null
}

const str = (v) => (v && v.stringValue) || ''
const numv = (v) => (v ? Number(v.doubleValue !== undefined ? v.doubleValue : v.integerValue) : null)
const map = (v) => (v && v.mapValue && v.mapValue.fields) || {}
const list = (v) => (v && v.arrayValue && v.arrayValue.values) || []

function trustedAlert(id, body) {
  const to = (body.contacts || []).map((c) => String(c.email || '').trim()).filter((m) => EMAIL.test(m)).slice(0, MAX_RECIPIENTS)
  if (!to.length) return out({ ok: false, error: 'no contacts' })
  const props = PropertiesService.getScriptProperties()
  if (props.getProperty('sent:' + id)) return out({ ok: true, already: true })

  const f = readIncident(id)
  if (!f) return out({ ok: false, error: 'not found' })
  if (str(f.severity) !== 'high') return out({ ok: false, error: 'not high' })

  const loc = map(f.location), conf = map(loc.confirmed), rough = map(loc.rough)
  const lat = numv(conf.lat) ?? numv(rough.lat), lng = numv(conf.lng) ?? numv(rough.lng)
  const address = str(conf.address)
  const mapUrl = lat != null && lng != null ? 'https://maps.google.com/?q=' + lat + ',' + lng : ''
  const name = String(body.callerName || 'Someone who listed you as a trusted contact').slice(0, 60)

  const text = [
    name + ' may need help right now.',
    '',
    address ? 'Last stated location: ' + address : "Location: from their phone's GPS",
    mapUrl ? 'Map: ' + mapUrl : '',
    'Time: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
    '',
    'A response team has been alerted. If you can, try to reach them, or call 112.',
    'Please do not call or message them about this alert if someone dangerous may be with them.',
    '',
    'Reference: ' + id,
  ].join('\n')

  MailApp.sendEmail({ to: to.join(','), subject: 'Urgent: ' + name + ' may need help', body: text, name: 'QuickBite Safety' })
  props.setProperty('sent:' + id, new Date().toISOString())
  return out({ ok: true, sent: to.length })
}

function caseReport(id) {
  const props = PropertiesService.getScriptProperties()
  if (props.getProperty('report:' + id)) return out({ ok: true, already: true })
  const f = readIncident(id)
  if (!f) return out({ ok: false, error: 'not found' })
  // The address comes from the incident, never from the request.
  const to = str(f.reportEmail).trim()
  if (!EMAIL.test(to)) return out({ ok: false, error: 'no report email on the incident' })

  const conf = map(map(f.location).confirmed)
  const lat = numv(conf.lat), lng = numv(conf.lng)
  const dest = map(map(f.safeRoute).destination)
  const plate = str(map(f.vehicle).number)
  const seen = list(f.sceneObservations).slice(-8).map((o) => {
    const m = map(o)
    return '- ' + (str(m.source) === 'sound' ? 'Heard: ' : 'Seen on camera: ') + (str(m.detail) || str(m.kind))
  })
  const danger = list(map(f.extractedFieldsLive).dangerIndicators).slice(-10).map((d) => '- ' + str(d))
  const started = str(f.sessionStartedAt)

  const text = [
    'QuickBite Safety: your case report',
    '',
    'Reference number: ' + id + '   (give this to the police)',
    'Call started: ' + (started ? new Date(started).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'n/a'),
    'Severity: ' + (str(f.severity) || 'n/a'),
    '',
    'WHAT HAPPENED',
    str(f.consolidatedSummary) || str(f.transcriptSummary) || '(summary not available)',
    '',
    'LOCATION',
    str(conf.address) || 'From your phone',
    lat != null && lng != null ? 'Map: https://maps.google.com/?q=' + lat + ',' + lng : '',
    '',
    str(dest.name) ? 'NEAREST HELP YOU WERE GUIDED TO\n' + str(dest.name) + (str(dest.phone) ? ' (' + str(dest.phone) + ')' : '') : '',
    '',
    danger.length ? 'REPORTED DURING THE CALL\n' + danger.join('\n') : '',
    '',
    seen.length || plate ? 'EVIDENCE CAPTURED\n' + seen.join('\n') + (plate ? '\n- Vehicle number plate: ' + plate : '') : '',
    '',
    'The call recording and camera evidence are held by the response team under the reference number above.',
    'In an emergency, call 112.',
  ].join('\n').replace(/\n{3,}/g, '\n\n')

  MailApp.sendEmail({ to: to, subject: 'Your QuickBite case report: ' + id, body: text, name: 'QuickBite Safety' })
  props.setProperty('report:' + id, new Date().toISOString())
  return out({ ok: true, sent: 1 })
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
