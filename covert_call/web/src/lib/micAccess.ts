// Microphone access before a call: why it failed and how the caller can fix it on their phone.
//
// Callers reported that some phones never showed the permission box. The box only appears when the browser is
// allowed to ask: once the site (or the browser itself, in the phone's settings) has been blocked, or the link is
// opened inside an app's built-in browser (WhatsApp, Instagram, Facebook…), the request is refused silently. The
// call used to end on a bare "Couldn't connect"; now the cause is named and the steps for that phone are shown.

export type MicIssue =
  | 'blocked' // the browser refused (site blocked, or the browser has no mic permission on the phone)
  | 'in-app' // opened inside an app's built-in browser, which usually can't use the mic
  | 'unsupported' // no getUserMedia here (very old browser, or not https)
  | 'no-mic' // no microphone found
  | 'busy' // the mic is in use by something else (a phone call, a recorder)

export type Platform = 'android' | 'ios' | 'other'

export const platform = (): Platform => {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  return 'other'
}

// Built-in browsers of social/chat apps (and Android WebViews generally).
export const inAppBrowser = (): string | null => {
  const ua = navigator.userAgent
  if (/WhatsApp/i.test(ua)) return 'WhatsApp'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn'
  if (/Snapchat/i.test(ua)) return 'Snapchat'
  if (/Line\//i.test(ua)) return 'LINE'
  if (/; wv\)/i.test(ua)) return 'this app'
  return null
}

// Asks for the mic once (this is what shows the browser's permission box) and releases it again; the call opens
// it for real right after. Returns null when the mic works.
export async function checkMic(): Promise<MicIssue | null> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return inAppBrowser() ? 'in-app' : 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return null
  } catch (e) {
    const name = (e as DOMException)?.name ?? ''
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-mic'
    if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
    return inAppBrowser() ? 'in-app' : 'blocked'
  }
}

export type MicHelp = { title: string; intro: string; steps: string[]; canCopyLink?: boolean }

// What to tell the caller, worded as an ordinary food app would (the screen may be seen by someone else).
export function micHelp(issue: MicIssue): MicHelp {
  const p = platform()
  const app = inAppBrowser()
  if (issue === 'in-app') {
    return {
      title: 'Open QuickBite in your browser',
      intro: `${app === 'this app' || !app ? 'This app' : app}'s built-in browser can't use the microphone, so calls to order won't work here.`,
      steps: [
        p === 'ios' ? 'Tap the ••• or share button and choose "Open in Safari" (or "Open in browser").' : 'Tap the ⋮ menu and choose "Open in Chrome" (or "Open in browser").',
        'Or copy the link below and paste it into Chrome or Safari.',
        'Then tap "Call to order" again and allow the microphone.',
      ],
      canCopyLink: true,
    }
  }
  if (issue === 'unsupported') {
    return {
      title: 'Your browser can’t place calls',
      intro: 'Calls to order need a recent browser.',
      steps: ['Open QuickBite in Chrome (Android) or Safari (iPhone).', 'Copy the link below if you need it.'],
      canCopyLink: true,
    }
  }
  if (issue === 'no-mic') {
    return { title: 'No microphone found', intro: 'Your phone didn’t report a microphone.', steps: ['Unplug and re-plug any headset or earphones.', 'Then tap "Try again".'] }
  }
  if (issue === 'busy') {
    return {
      title: 'Microphone is busy',
      intro: 'Another app is using the microphone right now.',
      steps: ['Finish any phone or video call, or close apps that record sound.', 'Then tap "Try again".'],
    }
  }
  // blocked
  if (p === 'ios') {
    return {
      title: 'Allow the microphone',
      intro: 'Your phone blocked the microphone for QuickBite, so the call can’t start.',
      steps: [
        'Safari: tap "aA" in the address bar → Website Settings → Microphone → Allow.',
        'Chrome on iPhone: open the iPhone Settings app → Chrome → turn on Microphone.',
        'Safari still asking nothing? Settings app → Safari → Microphone → Ask or Allow.',
        'Come back and tap "Try again".',
      ],
    }
  }
  if (p === 'android') {
    return {
      title: 'Allow the microphone',
      intro: 'Your phone blocked the microphone for QuickBite, so the call can’t start.',
      steps: [
        'Tap the icon left of the web address (🔒 or ⚙) → Permissions → Microphone → Allow.',
        'Not listed? Chrome ⋮ menu → Settings → Site settings → Microphone → make sure it’s on, and remove QuickBite from "Blocked".',
        'Still nothing? Phone Settings → Apps → Chrome → Permissions → Microphone → Allow.',
        'Come back and tap "Try again".',
      ],
    }
  }
  return {
    title: 'Allow the microphone',
    intro: 'Your browser blocked the microphone for QuickBite.',
    steps: ['Click the icon left of the web address → Microphone → Allow.', 'Then click "Try again".'],
  }
}
