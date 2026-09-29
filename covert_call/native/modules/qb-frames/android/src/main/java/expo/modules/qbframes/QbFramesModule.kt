package expo.modules.qbframes

import android.util.Base64
import com.oney.WebRTCModule.videoEffects.ProcessorProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// JavaScript side of the frame tap. The processor has to be registered with react-native-webrtc by name before
// any track asks for it, which is what OnCreate is for; after that JavaScript installs it on a track with
// track._setVideoEffect('qb-frames') and collects stills with grabJpeg().
class QbFramesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QbFrames")

    OnCreate {
      ProcessorProvider.addProcessor(FrameTap.NAME, FrameTap.Factory())
    }

    // How often a still is kept, how wide it is, and its JPEG quality. Gemini Live takes roughly a frame a
    // second and tokenises each one, so there's nothing to gain from going faster or larger.
    Function("configure") { intervalMs: Int, maxWidth: Int, quality: Int ->
      FrameTap.intervalMs = intervalMs.toLong()
      FrameTap.maxWidth = maxWidth
      FrameTap.quality = quality
    }

    // The most recent still as base64 JPEG, or null if none has been captured yet. Each frame is handed out
    // once: returning the same still repeatedly would send Gemini duplicate images of a scene that hasn't
    // changed, and it charges per frame.
    Function("grabJpeg") {
      val jpeg = FrameTap.latestJpeg
      FrameTap.latestJpeg = null
      jpeg?.let { Base64.encodeToString(it, Base64.NO_WRAP) }
    }

    Function("reset") {
      FrameTap.reset()
    }

    // Returns what actually happened ("earpiece" / "refused" / "unchanged" / "failed") rather than a bare
    // boolean, because "the call is still on speaker" has several different causes and they need telling apart
    // from JavaScript without a device attached.
    Function("routeToEarpiece") {
      val context = appContext.reactContext ?: return@Function "no-context"
      AudioRouting.toEarpiece(context)
    }

    Function("releaseAudioRouting") {
      appContext.reactContext?.let { AudioRouting.release(it) }
    }
  }
}
