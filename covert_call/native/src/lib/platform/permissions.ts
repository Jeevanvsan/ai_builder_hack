import { PermissionsAndroid, Platform } from 'react-native'

// Asks for the microphone and camera up front, together, before anything tries to capture.
//
// Device testing showed no permission dialog appearing at all: the audio library's own
// requestRecordingPermissions() doesn't raise Android's dialog (it's effectively an iOS-side API), and the
// camera request only ran after the call had already tried and failed to open the mic. The capture then failed
// silently and the call was unusable until the permissions were switched on by hand in Android settings.
//
// Asking here, explicitly and before any capture starts, also means a person who triggers the SOS has already
// answered these dialogs during an ordinary call — so the black screen isn't interrupted by a permission prompt
// at the worst possible moment.
export async function ensureCapturePermissions(): Promise<{ mic: boolean; camera: boolean }> {
  if (Platform.OS !== 'android') return { mic: true, camera: true }

  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ])
    return {
      mic: result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED,
      camera: result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED,
    }
  } catch {
    // A refusal here must never stop the session: the call still connects (Gemini just won't hear anything) and
    // the SOS still raises its incident, which is better than not starting at all.
    return { mic: false, camera: false }
  }
}
