import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { User } from 'firebase/auth'

export const RESPONDERS = 'responders'

export type ResponderRole = 'admin' | 'responder'
export type ResponderStatus = 'active' | 'disabled'

// Document id is the responder's email — stable and known upfront by whoever adds them, unlike a Firebase Auth
// UID, which only Admin SDK (billing) can look up. Email also doubles as the sign-in identity.
export type Responder = {
  email: string
  name: string
  role: ResponderRole
  status: ResponderStatus
  createdAt?: string
  createdBy?: string
}

// The two founding admins get a responder doc created for them on first sign-in (see firestore.rules'
// isBootstrapAdmin) — everyone else must be added by an admin from the Responder Management page first.
const BOOTSTRAP_ADMIN_EMAILS = ['jeevan@quickbite.com', 'ameen@quickbite.com']

const ref = (email: string) => doc(db, RESPONDERS, email)
const now = () => new Date().toISOString()

export async function ensureBootstrapAdmin(user: User): Promise<void> {
  if (!user.email || !BOOTSTRAP_ADMIN_EMAILS.includes(user.email)) return
  const snap = await getDoc(ref(user.email))
  if (snap.exists()) return
  await setDoc(ref(user.email), {
    name: user.email.split('@')[0],
    email: user.email,
    role: 'admin',
    status: 'active',
    createdAt: now(),
    createdBy: user.email,
  })
}

export function getResponder(email: string) {
  return getDoc(ref(email))
}

export function watchResponders(cb: (responders: Responder[]) => void): () => void {
  return onSnapshot(collection(db, RESPONDERS), (snap) => {
    cb(snap.docs.map((d) => d.data() as Responder))
  })
}

// The new responder's Firebase Auth account must still be created separately in the Firebase console —
// this collection is a roster/directory, it does not create sign-in-able accounts (see status/person_b_jeevan.md).
export function addResponder(data: { name: string; email: string; role: ResponderRole }, createdBy: string) {
  return setDoc(ref(data.email), { ...data, status: 'active' as const, createdAt: now(), createdBy })
}

export function updateResponder(email: string, data: Partial<Pick<Responder, 'name' | 'role' | 'status'>>) {
  return updateDoc(ref(email), data)
}

export function deleteResponder(email: string) {
  return deleteDoc(ref(email))
}
