import { getAuth, linkWithPhoneNumber, PhoneAuthProvider, RecaptchaVerifier, signInAnonymously, signInWithCredential, signInWithPhoneNumber, type ConfirmationResult, type User } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { setCallerUid } from '../../../shared/incidents/client.ts'
import { app, db } from './firebase'

// Epic 31: who is calling. Every install signs in anonymously (invisible, no prompt), so all calls from one phone
// share one caller id: a responder can see repeat calls, and a device that keeps making false calls can be
// flagged. Verifying a mobile number (the OTP every delivery app asks for) links a real number to that id.
// The number never goes on the incident (incidents are readable by the caller app); it lives in callers/{uid},
// which only signed-in responders can read. A call is NEVER blocked on any of this.

export const auth = getAuth(app)

export type CallerProfile = {
  phone: string | null
  phoneVerifiedAt: string | null
  // "Share live order updates" in the app = trusted contacts alerted when a call turns serious (Epic 32).
  contacts: { name: string; email: string }[]
}

let ready: Promise<string | null> | null = null
// Starts the anonymous sign-in once, at app load. Resolves to the caller id, or null if auth is unavailable.
export function callerReady(): Promise<string | null> {
  if (!ready) {
    ready = (auth.currentUser ? Promise.resolve(auth.currentUser) : signInAnonymously(auth).then((c) => c.user))
      .then((u) => u.uid)
      .catch((e) => { console.warn('[QuickBite] anonymous sign-in failed; calls continue without a caller id:', e); return null })
  }
  return ready
}

// For the call and SOS start: the caller id if it arrives within 2 s, otherwise null. Never delays help.
export function callerUidQuick(): Promise<string | null> {
  return Promise.race([callerReady(), new Promise<null>((r) => setTimeout(() => r(null), 2000))])
}

const profileRef = (uid: string) => doc(db, 'callers', uid)

export async function loadProfile(): Promise<CallerProfile> {
  const uid = await callerReady()
  const empty: CallerProfile = { phone: null, phoneVerifiedAt: null, contacts: [] }
  if (!uid) return empty
  const snap = await getDoc(profileRef(uid)).catch(() => null)
  return snap?.exists() ? { ...empty, ...(snap.data() as Partial<CallerProfile>) } : empty
}

async function saveProfile(patch: Partial<CallerProfile>): Promise<void> {
  const uid = await callerReady()
  if (!uid) throw new Error('Not signed in')
  await setDoc(profileRef(uid), { ...patch, updatedAt: new Date().toISOString() }, { merge: true })
}

export const saveContacts = (contacts: CallerProfile['contacts']) => saveProfile({ contacts: contacts.slice(0, 3) })

// Mobile OTP. `buttonId` is the element the invisible reCAPTCHA attaches to (the "Send OTP" button).
let verifier: RecaptchaVerifier | null = null
export async function sendOtp(phoneE164: string, buttonId: string): Promise<ConfirmationResult> {
  await callerReady()
  verifier?.clear()
  verifier = new RecaptchaVerifier(auth, buttonId, { size: 'invisible' })
  // Normally the number is linked to this phone's anonymous caller id; if anonymous sign-in wasn't available,
  // signing in with the phone number gives the device its id instead.
  return auth.currentUser ? linkWithPhoneNumber(auth.currentUser, phoneE164, verifier) : signInWithPhoneNumber(auth, phoneE164, verifier)
}

export async function confirmOtp(confirmation: ConfirmationResult, code: string): Promise<void> {
  let user: User
  try {
    user = (await confirmation.confirm(code)).user
  } catch (e) {
    // This number was verified before on another device or browser: sign back into that account instead, so its
    // trusted contacts and call history come back. (The new anonymous id is simply left unused.)
    const old = (e as FirebaseError).code === 'auth/credential-already-in-use' ? PhoneAuthProvider.credentialFromError(e as FirebaseError) : null
    if (!old) throw e
    user = (await signInWithCredential(auth, old)).user
  }
  ready = Promise.resolve(user.uid)
  setCallerUid(user.uid)
  await saveProfile({ phone: user.phoneNumber, phoneVerifiedAt: new Date().toISOString() })
}
