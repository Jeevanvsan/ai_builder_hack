// Clears the live queue: marks every incident that isn't resolved yet as resolved (and ends any call still shown
// as live), with a team note saying so. Useful before a demo or rehearsal.
//
// Closing a case is a responder action, so this signs in as a responder. Credentials come from the environment
// only (never stored in the repo):
//   PowerShell:  $env:RESPONDER_EMAIL='you@quickbite.com'; $env:RESPONDER_PASSWORD='...'; npm run resolve-all
//   Bash:        RESPONDER_EMAIL=you@quickbite.com RESPONDER_PASSWORD=... npm run resolve-all
// It only lists what it would change unless you add --yes:  npm run resolve-all -- --yes
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { arrayUnion, collection, doc, getDocs, query, terminate, updateDoc, where } from 'firebase/firestore'
import { db } from './db.ts'

const apply = process.argv.includes('--yes')
const email = process.env.RESPONDER_EMAIL
const password = process.env.RESPONDER_PASSWORD
if (!email || !password) {
  console.error('Set RESPONDER_EMAIL and RESPONDER_PASSWORD (a responder account) first. See the comment at the top of this file.')
  process.exit(1)
}

await signInWithEmailAndPassword(getAuth(getApp()), email, password)
const snap = await getDocs(query(collection(db, 'incidents'), where('response.status', 'in', ['new', 'acknowledged', 'in_progress'])))
console.log(`${snap.size} unresolved incident(s)${apply ? '' : ' (dry run: add --yes to resolve them)'}`)

const at = new Date().toISOString()
let done = 0
for (const d of snap.docs) {
  const i = d.data()
  console.log(`  ${d.id}  ${i.response.status.padEnd(12)} ${i.callState}  ${i.channel}  ${i.sessionStartedAt}`)
  if (!apply) continue
  await updateDoc(doc(db, 'incidents', d.id), {
    'response.status': 'resolved',
    'response.resolvedAt': at,
    'response.notes': arrayUnion({ responderId: email, text: 'Bulk-resolved to clear the queue (resolve-all script).', at }),
    ...(i.callState === 'active' ? { callState: 'ended', sessionEndedAt: i.sessionEndedAt ?? at } : {}),
  })
  done++
}
if (apply) console.log(`Resolved ${done} incident(s).`)
await terminate(db)
process.exit(0)
