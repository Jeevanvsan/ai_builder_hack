package expo.modules.qbframes

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.util.Log

// Forces call audio to the earpiece.
//
// This exists because nothing reachable from JavaScript can do it on a modern Android. The audio engine that
// gives us echo cancellation claims the loudspeaker with setCommunicationDevice() during its own startup, and
// react-native-incall-manager — the obvious off-the-shelf answer — only ever calls the deprecated
// setSpeakerphoneOn(), which no longer wins against an explicit communication device on API 31+. So the same
// API has to be used against it, from native code, after that engine has started.
//
// Why bother: on speakerphone everyone in the room hears Mia asking coded safety questions, including whoever
// the caller is hiding the call from. Held to the ear, only the caller hears her.
object AudioRouting {
  private const val TAG = "QbAudioRouting"

  // A headset or car kit is a deliberate choice by the caller and almost certainly more private than the
  // earpiece, so those win. Only the built-in loudspeaker is overridden.
  private val PREFERRED = listOf(
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    AudioDeviceInfo.TYPE_WIRED_HEADSET,
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE,
  )

  fun toEarpiece(context: Context): String {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    return try {
      am.mode = AudioManager.MODE_IN_COMMUNICATION

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val available = am.availableCommunicationDevices
        val target = PREFERRED.firstNotNullOfOrNull { type -> available.firstOrNull { it.type == type } }
        if (target == null) {
          // A tablet with no earpiece at all — leave whatever is already selected rather than breaking audio.
          Log.w(TAG, "no earpiece or headset available; leaving routing as it is")
          return "unchanged"
        }
        val ok = am.setCommunicationDevice(target)
        Log.i(TAG, "communication device -> ${target.type} (accepted=$ok)")
        if (ok) "earpiece" else "refused"
      } else {
        @Suppress("DEPRECATION")
        am.isSpeakerphoneOn = false
        "earpiece"
      }
    } catch (e: Throwable) {
      Log.w(TAG, "could not route to the earpiece", e)
      "failed"
    }
  }

  // Hands routing back so the phone isn't left in communication mode, which would quietly change how every
  // other app's audio behaves.
  fun release(context: Context) {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice()
      am.mode = AudioManager.MODE_NORMAL
    } catch (e: Throwable) {
      Log.w(TAG, "could not release audio routing", e)
    }
  }
}
