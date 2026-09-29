import { PermissionsAndroid, Platform } from 'react-native'
import { mediaDevices } from 'react-native-webrtc'

// Native counterpart to the camera half of web/src/lib/gemini/media.ts.
//
// The streams come from react-native-webrtc, which is what `shared/video/publisher.ts` expects — that file then
// runs completely unchanged, so the dashboard's live-video viewer works with a phone-raised incident exactly as
// it already does with the browser.
//
// Two things the web does that are deliberately NOT done here:
//   - The mic is not requested. On native the microphone is already owned by the Gemini session
//     (lib/platform/audio.ts), and Android will not reliably give the same mic to a second capture; the loser
//     goes silent, and that could be the Gemini feed. So these streams are video-only.
//   - There is no "is this camera actually producing frames?" check. The web compares two canvas samples to
//     catch a phone that silently freezes one of two simultaneous streams. React Native has no canvas, so that
//     check needs the same native frame source that camera-frames-to-Gemini needs. A frozen second camera is
//     therefore still possible here; it would show as a stalled tile on the dashboard rather than a missing one.

// react-native-webrtc's MediaStream is its own class, not the DOM one the shared publisher is typed against.
// They're structurally the same at the points the publisher touches (getTracks/getVideoTracks/getAudioTracks),
// and registerGlobals() in index.ts makes the RTC globals real, so this cast is the seam between the two.
export type RtcStream = MediaStream

export type SosCameras = {
  cameras: { facing: 'back' | 'front'; stream: RtcStream }[]
  mode: 'dual' | 'back-only'
}

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
    return granted === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

async function openCamera(facing: 'environment' | 'user'): Promise<RtcStream | null> {
  try {
    const stream = await mediaDevices.getUserMedia({ video: { facingMode: facing } })
    return stream as unknown as RtcStream
  } catch {
    return null
  }
}

// The call publishes one back-camera feed (Epic 9). Returns null when there's no camera or permission was
// refused — the call then runs audio-only, exactly as the web falls back.
export async function acquireCallCamera(): Promise<RtcStream | null> {
  if (!(await ensureCameraPermission())) return null
  return openCamera('environment')
}

// The SOS publishes every camera it can get (Epic 11), so a responder can switch between them. Many phones
// refuse two simultaneous camera streams, in which case this falls back to back-only — the same outcome the web
// reports, and the same `mode` value the dashboard already understands.
export async function acquireSosCameras(): Promise<SosCameras> {
  if (!(await ensureCameraPermission())) return { cameras: [], mode: 'back-only' }

  const cameras: SosCameras['cameras'] = []

  const back = await openCamera('environment')
  if (back) cameras.push({ facing: 'back', stream: back })

  const front = await openCamera('user')
  if (front) cameras.push({ facing: 'front', stream: front })

  return { cameras, mode: cameras.length >= 2 ? 'dual' : 'back-only' }
}

export function stopStream(stream: RtcStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}
