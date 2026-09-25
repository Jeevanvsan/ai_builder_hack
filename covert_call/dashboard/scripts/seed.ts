// Writes the mock incidents into Firestore.
//   (default)  adds only seed incidents that don't exist yet; the security rules don't allow rewinding a case.
//   --reset    first deletes every incident through the Firebase CLI (uses your CLI login, which bypasses the
//              security rules), then writes all seed incidents fresh.
import { execSync } from 'node:child_process'
import { doc, getDoc, setDoc, terminate } from 'firebase/firestore'
import { db } from './db.ts'
import { mockIncidents } from '../src/lib/mockIncidents.ts'

const emulator = process.argv.includes('--emulator')

if (process.argv.includes('--reset')) {
  execSync('npx firebase-tools firestore:delete incidents --recursive --force --project quickbite-5cde0', {
    stdio: 'inherit',
    env: emulator ? { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' } : process.env,
  })
  console.log('Deleted all incidents')
}

for (const { id, ...data } of mockIncidents) {
  const ref = doc(db, 'incidents', id)
  if ((await getDoc(ref)).exists()) {
    console.log(`Skipped ${id} (already exists)`)
    continue
  }
  await setDoc(ref, data)
  console.log(`Wrote ${id}`)
}

await terminate(db)
