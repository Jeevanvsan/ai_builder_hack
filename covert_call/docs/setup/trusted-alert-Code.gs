// QuickBite Apps Script (paste this WHOLE file over Code.gs, then Deploy → Manage deployments → edit → New version).
// 1. Trusted-contact alert: emails the caller's trusted contacts when their call turns high severity.
// 2. Case report: when a danger call ends, emails the caller the full case report (HTML + PDF attachment, with the
//    scene sketch and camera snaps) at the address saved on the incident, and records sent/failed on the incident.
const PROJECT = 'quickbite-5cde0'
const DOCS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/'
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
  const res = UrlFetchApp.fetch(DOCS + 'incidents/' + id, { muteHttpExceptions: true })
  return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()).fields || {} : null
}

function readSnaps(id) {
  const res = UrlFetchApp.fetch(DOCS + 'incidents/' + id + '/snaps?pageSize=12', { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) return []
  return (JSON.parse(res.getContentText()).documents || []).map((d) => d.fields || {})
    .sort((a, b) => (str(a.at) < str(b.at) ? -1 : 1))
}

// Record the email outcome on the incident (the dashboard's Case file shows it).
function setStatus(id, status, to, error) {
  const fields = { status: { stringValue: status }, to: { stringValue: to }, at: { stringValue: new Date().toISOString() } }
  if (error) fields.error = { stringValue: String(error).slice(0, 200) }
  UrlFetchApp.fetch(DOCS + 'incidents/' + id + '?updateMask.fieldPaths=reportEmailStatus', {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify({ fields: { reportEmailStatus: { mapValue: { fields: fields } } } }),
    muteHttpExceptions: true,
  })
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
  let f = readIncident(id)
  if (!f) return out({ ok: false, error: 'not found' })
  // The address comes from the incident, never from the request.
  const to = str(f.reportEmail).trim()
  if (!EMAIL.test(to)) return out({ ok: false, error: 'no report email on the incident' })
  props.setProperty('report:' + id, 'sending')

  try {
    // The app calls this the moment the call ends; the AI summary lands a few seconds later. Wait up to ~25 s.
    for (let k = 0; k < 5 && !str(f.consolidatedSummary) && !(f.consolidationFailed && f.consolidationFailed.booleanValue); k++) {
      Utilities.sleep(5000)
      f = readIncident(id) || f
    }
    const snaps = readSnaps(id)
    const r = buildReport(id, f, snaps)
    const pdf = Utilities.newBlob(r.pdfHtml, 'text/html', 'case.html').getAs('application/pdf').setName('QuickBite-case-report-' + id + '.pdf')
    MailApp.sendEmail({
      to: to,
      subject: 'Your QuickBite case report: ' + id,
      body: r.text,
      htmlBody: r.html,
      inlineImages: r.images,
      attachments: [pdf],
      name: 'QuickBite Safety',
    })
    props.setProperty('report:' + id, new Date().toISOString())
    setStatus(id, 'sent', to)
    return out({ ok: true, sent: 1 })
  } catch (err) {
    props.deleteProperty('report:' + id)
    setStatus(id, 'failed', to, err)
    return out({ ok: false, error: String(err) })
  }
}

// Everything recorded on the incident: HTML for the email (images inline by cid), HTML for the PDF (images as
// data URIs) and a plain-text copy.
function buildReport(id, f, snaps) {
  const IST = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : '')
  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '')
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const mapUrl = (lat, lng) => 'https://maps.google.com/?q=' + lat + ',' + lng
  const link = (label, url) => ({ text: label + ': ' + url, html: esc(label) + ': <a href="' + url + '">' + esc(url) + '</a>' })

  const sections = [] // [title, lines]; a line is a string or {text, html}
  const add = (title, lines) => { const l = lines.filter((x) => x !== '' && x != null); if (l.length) sections.push([title, l]) }

  const started = str(f.sessionStartedAt), ended = str(f.sessionEndedAt)
  const mins = started && ended ? Math.max(1, Math.round((new Date(ended) - new Date(started)) / 60000)) : null
  const resp = map(f.response)
  add('Overview', [
    'Reference number: ' + id + ' (give this to the police)',
    'Call started: ' + IST(started),
    ended ? 'Call ended: ' + IST(ended) + (mins ? ' (about ' + mins + ' min)' : '') : '',
    'Severity: ' + (str(f.severity) || 'n/a').toUpperCase(),
    str(f.recommendation) ? 'Recommendation: ' + str(f.recommendation) : '',
    str(resp.status) ? 'Response status: ' + str(resp.status) : '',
  ])

  add('What happened (summary)', [str(f.consolidatedSummary) || str(f.transcriptSummary) || '(the AI summary was not ready; see the details below)'])

  const b = map(f.bulletin)
  add('Key points', [
    str(b.location) ? 'Location: ' + str(b.location) : '',
    str(b.subjects) ? 'People involved: ' + str(b.subjects) : '',
    str(b.weapons) ? 'Weapons: ' + str(b.weapons) : '',
    str(b.vehicle) ? 'Vehicle: ' + str(b.vehicle) : '',
    str(b.status) ? 'Status: ' + str(b.status) : '',
    str(b.recommendedAction) ? 'Recommended action: ' + str(b.recommendedAction) : '',
  ])

  const live = map(f.extractedFieldsLive)
  add('Danger reported during the call', list(live.dangerIndicators).map((d) => '• ' + str(d)))

  // Location and movement
  const loc = map(f.location), conf = map(loc.confirmed), rough = map(loc.rough)
  const track = list(loc.track).map(map)
  const cl = numv(conf.lat), cg = numv(conf.lng), rl = numv(rough.lat), rg = numv(rough.lng)
  const last = track.length ? track[track.length - 1] : null
  add('Locations', [
    str(conf.address) ? 'Address given by the caller: ' + str(conf.address) + (str(conf.confidence) === 'uncertain' ? ' (approximate)' : '') + (str(conf.confirmedAt) ? ', at ' + time(str(conf.confirmedAt)) : '') : '',
    cl != null && cg != null ? link('Address on the map', mapUrl(cl, cg)) : '',
    cl != null && cg != null ? 'Coordinates: ' + cl.toFixed(5) + ', ' + cg.toFixed(5) : '',
    rl != null && rg != null ? link('Phone position when the call started', mapUrl(rl, rg)) : '',
    track.length ? 'Movement trail: ' + track.length + ' positions' + (last ? ', last at ' + time(str(last.at)) : '') : '',
    last ? link('Last known position', mapUrl(numv(last.lat), numv(last.lng))) : '',
  ].concat(track.length > 1 ? track.slice(-10).map((t) => '• ' + time(str(t.at)) + '  ' + numv(t.lat).toFixed(5) + ', ' + numv(t.lng).toFixed(5)) : []))

  // Route to safety
  const route = map(f.safeRoute), dest = map(route.destination)
  if (str(dest.name)) {
    const dl = numv(dest.lat), dg = numv(dest.lng)
    const steps = list(route.steps).map(map).map((st, k) => (k + 1) + '. ' + str(st.instruction) + (numv(st.distanceM) ? ' (' + numv(st.distanceM) + ' m)' : ''))
    add('Route to safety', [
      'Destination: ' + str(dest.name) + ' (' + str(dest.kind) + ')' + (str(dest.phone) ? ', phone ' + str(dest.phone) : ''),
      numv(route.distanceM) != null ? 'Distance: ' + numv(route.distanceM) + ' m, about ' + Math.max(1, Math.round(numv(route.durationS) / 60)) + ' min by road' : '',
      str(route.reason) ? 'Reason: ' + str(route.reason) : '',
      str(route.requestedBy) ? 'Chosen by: ' + (str(route.requestedBy) === 'responder' ? 'the dispatcher' : 'the AI') : '',
      dl != null ? link('Destination on the map', mapUrl(dl, dg)) : '',
      cl != null && dl != null ? link('Directions', 'https://www.google.com/maps/dir/' + cl + ',' + cg + '/' + dl + ',' + dg) : '',
    ].concat(steps.length ? ['Turn-by-turn directions given:'].concat(steps) : []))
  }

  // People and vehicle
  const est = map(f.callerEstimate)
  add('People', [
    live.peopleCount && (live.peopleCount.integerValue || live.peopleCount.doubleValue) ? 'People involved: ' + (live.peopleCount.integerValue || live.peopleCount.doubleValue) : '',
    str(live.urgency) ? 'Urgency: ' + str(live.urgency) : '',
    str(est.ageGroup) ? 'Caller (estimated from voice): ' + str(est.ageGroup) + ', ' + str(est.gender) : '',
    str(live.notes) ? 'Notes: ' + str(live.notes) : '',
  ])
  const veh = map(f.vehicle)
  const scene = list(f.sceneObservations).map(map)
  const cars = scene.filter((o) => str(o.category) === 'vehicle' || o.vehicle).map((o) => {
    const v = map(o.vehicle)
    return '• ' + ([str(v.colour), str(v.type)].filter(String).join(' ') || str(o.detail) || str(o.kind)) + (str(v.plate) ? ', plate ' + str(v.plate) : '') + ' (seen ' + time(str(o.at)) + ')'
  })
  add('Vehicle', [
    str(veh.number) ? 'Number plate: ' + str(veh.number) + (str(veh.region) ? ' (' + str(veh.region) + ')' : '') + ', ' + (str(veh.source) === 'camera' ? 'read on camera' : 'given by the caller') : '',
  ].concat(cars))

  // Evidence
  add('Seen on camera and heard in the background', scene.map((o) => '• ' + time(str(o.at)) + '  ' + (str(o.source) === 'sound' ? 'Heard: ' : 'Seen: ') + (str(o.detail) || str(o.kind))))
  add('Other signals', list(f.coercionSignals).map(map).map((c) => '• ' + time(str(c.at)) + '  Possible coercion: ' + (str(c.detail) || str(c.kind)))
    .concat(list(f.motionEvents).map(map).map((m) => '• ' + time(str(m.at)) + '  Phone motion: ' + str(m.kind))))
  const stress = list(f.voiceStressTrend).map(map).map((s) => numv(s.score)).filter((n) => n != null)
  add('Voice stress', stress.length ? ['Peak ' + Math.max.apply(null, stress) + '/100, last ' + stress[stress.length - 1] + '/100, ' + stress.length + ' readings'] : [])
  const rec = [map(f.audioRecording)].concat(list(f.videoRecording).map(map)).filter((x) => str(x.driveUrl))
  add('Recordings', rec.map((x) => link(x.camera ? 'Video (' + str(x.camera) + ' camera)' : 'Call audio', str(x.driveUrl))))
  add('AI reasoning during the call', list(f.reasoningTrace).map(map).map((t) => '• ' + time(str(t.at)) + '  ' + str(t.text)))
  add('Safety advice given', list(f.adviceGiven).map(map).map((a) => '• ' + time(str(a.at)) + '  ' + str(a.text)))
  add('Responder notes', list(resp.notes).map(map).map((n) => '• ' + time(str(n.at)) + '  ' + str(n.text)))

  const convo = list(f.transcriptLines).map(map).map((l) => {
    const who = str(l.speaker) === 'Mia' ? 'Mia (QuickBite)' : 'You'
    return { text: time(str(l.at)) + '  ' + who + ': ' + str(l.text), html: '<span style="color:#888">' + esc(time(str(l.at))) + '</span> <b>' + who + ':</b> ' + esc(str(l.text)) }
  })

  // Images: the scene sketch first, then camera snaps.
  const images = {}
  const rank = { sketch: 0, map: 1, camera: 2 }
  const pics = snaps.filter((s) => str(s.base64)).sort((a, b) => (rank[str(a.kind)] ?? 3) - (rank[str(b.kind)] ?? 3))
  const picHtml = (inline) => pics.map((s, k) => {
    const cid = 'pic' + k
    if (inline) images[cid] = Utilities.newBlob(Utilities.base64Decode(str(s.base64)), str(s.mimeType) || 'image/jpeg', cid + '.jpg')
    const src = inline ? 'cid:' + cid : 'data:' + (str(s.mimeType) || 'image/jpeg') + ';base64,' + str(s.base64)
    const cap = (str(s.kind) === 'camera' ? 'Camera, ' + time(str(s.at)) + ': ' : '') + str(s.caption)
    return '<div style="margin:10px 0"><img src="' + src + '" style="max-width:100%;width:' + (str(s.kind) === 'camera' ? '420' : '640') + 'px;border:1px solid #ddd;border-radius:6px"><div style="color:#555;font-size:12px">' + esc(cap) + '</div></div>'
  }).join('')

  const footer = 'The call recording and camera evidence are held by the response team under reference ' + id + '. In an emergency, call 112.'
  const sectionsHtml = sections.map(([t, ls]) => '<h3 style="margin:18px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px;color:#111">' + esc(t) + '</h3>'
    + ls.map((l) => '<div style="margin:2px 0;line-height:1.45">' + (typeof l === 'string' ? esc(l) : l.html) + '</div>').join('')).join('')
  const convoHtml = convo.length ? '<h3 style="margin:18px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px">Full conversation</h3>' + convo.map((l) => '<div style="margin:3px 0;line-height:1.45">' + l.html + '</div>').join('') : ''
  const page = (imgs) => '<div style="font-family:Arial,sans-serif;font-size:13px;color:#222;max-width:700px">'
    + '<h2 style="color:#d9480f;margin:0 0 4px">QuickBite Safety: case report</h2>'
    + '<p style="margin:0 0 12px;color:#555">Reference number <b>' + esc(id) + '</b>. Show this report to the police.</p>'
    + (imgs ? '<h3 style="margin:14px 0 6px">Scene sketch, map and camera snaps</h3>' + imgs : '')
    + sectionsHtml + convoHtml
    + '<p style="margin-top:20px;color:#555">' + esc(footer) + '</p></div>'

  const html = page(picHtml(true))
  const pdfHtml = '<html><body>' + page(picHtml(false)) + '</body></html>'
  const text = ['QuickBite Safety: case report', ''].concat(sections.map(([t, ls]) => t.toUpperCase() + '\n' + ls.map((l) => (typeof l === 'string' ? l : l.text)).join('\n')))
    .concat(convo.length ? ['FULL CONVERSATION\n' + convo.map((l) => l.text).join('\n')] : []).concat(['', footer, '', 'The full report with the scene sketch and camera snaps is attached as a PDF.']).join('\n\n')
  return { text: text, html: html, pdfHtml: pdfHtml, images: images }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
