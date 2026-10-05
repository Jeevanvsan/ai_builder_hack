import { useEffect, useState } from 'react'
import type { ConfirmationResult } from 'firebase/auth'
import { PageHeader } from '../components/disguise/PageHeader'
import { confirmOtp, loadProfile, saveContacts, sendOtp, type CallerProfile } from '../lib/caller'

// Epic 31/32: an ordinary food-app account page. "Verify mobile" links a real number to this phone's caller id,
// and "Share live order updates" is really the trusted contacts who get an alert if a call turns serious. Nothing
// here mentions safety, so the page looks normal to anyone checking the phone.
type Contact = CallerProfile['contacts'][number]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AccountPage() {
  const [profile, setProfile] = useState<CallerProfile | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactMsg, setContactMsg] = useState<string | null>(null)

  useEffect(() => {
    void loadProfile().then((p) => { setProfile(p); setContacts(p.contacts) })
  }, [])

  const send = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) { setPhoneMsg('Enter your 10-digit mobile number.'); return }
    setBusy(true); setPhoneMsg(null)
    try {
      setConfirmation(await sendOtp(`+91${digits}`, 'otp-send'))
      setPhoneMsg(`OTP sent to +91 ${digits}.`)
    } catch (e) {
      console.warn('[QuickBite] OTP send failed:', e)
      const err = String(e)
      setPhoneMsg(/already|in-use/i.test(err) ? 'This number is already linked to another account.'
        : /quota|too-many/i.test(err) ? 'Too many OTPs today. Please try again tomorrow.'
          : "Couldn't send the OTP. Try again in a minute.")
    } finally { setBusy(false) }
  }

  const verify = async () => {
    if (!confirmation || code.trim().length < 6) return
    setBusy(true); setPhoneMsg(null)
    try {
      await confirmOtp(confirmation, code.trim())
      setProfile(await loadProfile())
      setConfirmation(null); setCode('')
    } catch {
      setPhoneMsg('That code is not right. Check the SMS and try again.')
    } finally { setBusy(false) }
  }

  const setContact = (i: number, patch: Partial<Contact>) => setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const saveAll = async () => {
    const clean = contacts.map((c) => ({ name: c.name.trim(), email: c.email.trim() })).filter((c) => c.email)
    if (clean.some((c) => !EMAIL.test(c.email))) { setContactMsg('One of the emails looks wrong.'); return }
    try {
      await saveContacts(clean)
      setContacts(clean)
      setContactMsg('Saved.')
    } catch {
      setContactMsg("Couldn't save. Check your connection and try again.")
    }
  }

  return (
    <div className="page page-sub">
      <PageHeader title="My account" backTo="/" />

      <section className="card">
        <h2 className="card-title">Mobile number</h2>
        {profile?.phone ? (
          <p className="account-verified">✓ {profile.phone} <span className="muted">verified</span></p>
        ) : (
          <>
            <p className="muted account-help">Verify your number to get delivery updates by SMS.</p>
            {!confirmation ? (
              <div className="account-row">
                <span className="account-prefix">+91</span>
                <input className="account-input" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <button id="otp-send" type="button" className="primary-btn account-btn" disabled={busy} onClick={() => void send()}>Send OTP</button>
              </div>
            ) : (
              <div className="account-row">
                <input className="account-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit OTP" value={code} onChange={(e) => setCode(e.target.value)} />
                <button type="button" className="primary-btn account-btn" disabled={busy} onClick={() => void verify()}>Verify</button>
              </div>
            )}
          </>
        )}
        {phoneMsg && <p className="account-msg">{phoneMsg}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Share live order updates</h2>
        <p className="muted account-help">Family or friends who should get your live order status by email. Up to 3.</p>
        {contacts.map((c, i) => (
          <div key={i} className="account-contact">
            <div className="account-contact-head">
              <span>Person {i + 1}</span>
              <button type="button" className="link-btn" onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <input className="account-input" placeholder="Name" autoComplete="name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
            <input className="account-input" type="email" placeholder="Email" autoComplete="email" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} />
          </div>
        ))}
        {contacts.length < 3 && (
          <button type="button" className="link-btn account-add" onClick={() => setContacts((cs) => [...cs, { name: '', email: '' }])}>+ Add someone</button>
        )}
        <button type="button" className="primary-btn account-save" onClick={() => void saveAll()}>Save</button>
        {contactMsg && <p className="account-msg">{contactMsg}</p>}
      </section>
    </div>
  )
}
