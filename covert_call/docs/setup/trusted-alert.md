# Trusted-contact email alert (Epic 32)

When a call or Silent SOS turns **high severity**, the QuickBite app emails the caller's trusted contacts (set in
the app under **My account → Share live order updates**) with the location and a map link. It's sent by a small
**Google Apps Script web app running under the QuickBite Gmail account**, so no email password is ever in the app,
and it needs **no billing** (Apps Script can send about 100 emails a day on a free Gmail account).

The script never trusts the app blindly: it re-reads the incident from Firestore and only sends if that incident
really exists and is high severity, at most once per incident, to at most 3 addresses.

## 1. Create the script (signed in as the QuickBite Gmail)
1. Go to <https://script.google.com> → **New project**, name it `QuickBite trusted alert`.
2. Replace `Code.gs` with the script below.
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me** (the QuickBite Gmail).
   - Who has access: **Anyone**.
4. Authorise it when asked (it needs "send email as you" and "connect to an external service").
5. Copy the **Web app URL** (ends in `/exec`).

```javascript
// Apps Script: emails a QuickBite caller's trusted contacts when their call turns high severity.
const PROJECT = 'quickbite-5cde0'
const MAX_RECIPIENTS = 3
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const id = String(body.incidentId || '')
    if (!/^INC-[A-Za-z0-9-]{2,32}$/.test(id)) return out({ ok: false, error: 'bad id' })
    const to = (body.contacts || []).map((c) => String(c.email || '').trim()).filter((m) => EMAIL.test(m)).slice(0, MAX_RECIPIENTS)
    if (!to.length) return out({ ok: false, error: 'no contacts' })

    // Once per incident.
    const props = PropertiesService.getScriptProperties()
    if (props.getProperty('sent:' + id)) return out({ ok: true, already: true })

    // Re-read the incident: it must exist and be high severity.
    const res = UrlFetchApp.fetch(
      'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/incidents/' + id,
      { muteHttpExceptions: true },
    )
    if (res.getResponseCode() !== 200) return out({ ok: false, error: 'not found' })
    const f = JSON.parse(res.getContentText()).fields
    if (((f.severity || {}).stringValue) !== 'high') return out({ ok: false, error: 'not high' })

    const loc = (f.location || {}).mapValue ? f.location.mapValue.fields : {}
    const conf = loc.confirmed && loc.confirmed.mapValue ? loc.confirmed.mapValue.fields : null
    const rough = loc.rough && loc.rough.mapValue ? loc.rough.mapValue.fields : null
    const num = (v) => (v ? Number(v.doubleValue !== undefined ? v.doubleValue : v.integerValue) : null)
    const lat = conf && conf.lat && conf.lat.doubleValue !== undefined ? num(conf.lat) : rough ? num(rough.lat) : null
    const lng = conf && conf.lng && conf.lng.doubleValue !== undefined ? num(conf.lng) : rough ? num(rough.lng) : null
    const address = conf && conf.address ? conf.address.stringValue : null
    const map = lat != null && lng != null ? 'https://maps.google.com/?q=' + lat + ',' + lng : null
    const name = String(body.callerName || 'Someone who listed you as a trusted contact').slice(0, 60)

    const text = [
      name + ' may need help right now.',
      '',
      address ? 'Last stated location: ' + address : 'Location: from their phone\'s GPS',
      map ? 'Map: ' + map : '',
      'Time: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      '',
      'A response team has been alerted. If you can, try to reach them, or call 112.',
      'Please do not call or message them about this alert if someone dangerous may be with them.',
      '',
      'Reference: ' + id,
    ].filter((l) => l !== null).join('\n')

    MailApp.sendEmail({ to: to.join(','), subject: 'Urgent: ' + name + ' may need help', body: text, name: 'QuickBite Safety' })
    props.setProperty('sent:' + id, new Date().toISOString())
    return out({ ok: true, sent: to.length })
  } catch (err) {
    return out({ ok: false, error: String(err) })
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
```

## 2. Point the app at it
Add the URL to `web/.env.local` and `web/.env.production.local` (both gitignored), then redeploy the web app:

```
VITE_TRUSTED_ALERT_URL=https://script.google.com/macros/s/XXXX/exec
```

With no URL set, the app simply skips the alert. Calls are never affected.

## 3. Test it
Add your own email under **My account → Share live order updates**, place a call, and report a high-severity
code (e.g. "extra pepperoni"). The email should arrive within a minute.

## 4. Case report email (after a danger call)
In a danger call, Mia asks for an email before the call ends ("I'll send you the full case report with a reference
number you can show the police") and saves it on the incident (`reportEmail`). When the call ends and the summary
is written, the app posts `{ type: 'case_report', incidentId }` to the same script URL. The script reads the address
**from the incident**, never from the request, so the public URL can't be used to mail anyone else. One report per
incident.

To turn it on, replace **all** of `Code.gs` with [trusted-alert-Code.gs](trusted-alert-Code.gs) (it contains both the
trusted-contact alert above and the case report), save, then **Deploy → Manage deployments → edit (pencil) →
Version: New version → Deploy**. The URL stays the same.
