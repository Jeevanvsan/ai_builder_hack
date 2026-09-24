// Writes the mock incidents into Firestore. Pass --reset to delete every existing incident first.
import { collection, deleteDoc, doc, getDocs, setDoc, terminate } from 'firebase/firestore'
import { db } from './db.ts'
import { mockIncidents } from '../src/lib/mockIncidents.ts'

if (process.argv.includes('--reset')) {
  const existing = await getDocs(collection(db, 'incidents'))
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)))
  console.log(`Deleted ${existing.size} existing incidents`)
}

for (const { id, ...data } of mockIncidents) {
  await setDoc(doc(db, 'incidents', id), data)
  console.log(`Wrote ${id}`)
}

await terminate(db)
