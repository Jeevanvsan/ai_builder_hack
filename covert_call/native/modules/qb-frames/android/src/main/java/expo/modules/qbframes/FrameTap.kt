package expo.modules.qbframes

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.util.Log
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessorFactoryInterface
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame
import java.io.ByteArrayOutputStream

// Takes a still every so often from a camera that WebRTC is already streaming, so Gemini can see the scene
// without a second camera being opened (Android generally won't allow that, and the live feed to the responder
// must not be disturbed).
//
// It plugs into react-native-webrtc's own video-effects hook: the library hands each captured frame to a
// processor and forwards whatever comes back. This processor returns the frame untouched, so the feed the
// responder watches is bit-for-bit what it would have been without it — the only cost is one JPEG encode per
// interval, on the capture thread.
//
// Frames are encoded eagerly and the bytes kept, rather than holding a VideoFrame for JavaScript to convert
// later. Retained frames come out of the capturer's own pool, so holding one starves the camera; a small JPEG
// costs a few tens of KB and belongs to us.
class FrameTap : VideoFrameProcessor {

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    maybeCapture(frame)
    // The caller releases both the frame it retained and whatever is returned. Returning the same object means
    // two releases against one retain, so claim the extra reference here or the frame is freed early and the
    // camera feed breaks.
    frame.retain()
    return frame
  }

  private fun maybeCapture(frame: VideoFrame) {
    val now = System.currentTimeMillis()
    if (now - lastCaptureMs < intervalMs) return
    lastCaptureMs = now
    try {
      latestJpeg = encode(frame, maxWidth, quality)
    } catch (e: Throwable) {
      // Never let an encoding problem take the camera feed down with it.
      Log.w(TAG, "frame capture failed", e)
    }
  }

  private fun encode(frame: VideoFrame, maxWidth: Int, quality: Int): ByteArray? {
    val source = frame.buffer
    val scale = minOf(1.0f, maxWidth.toFloat() / source.width)
    // I420 needs even dimensions.
    val outW = ((source.width * scale).toInt() / 2) * 2
    val outH = ((source.height * scale).toInt() / 2) * 2
    if (outW <= 0 || outH <= 0) return null

    val scaled = source.cropAndScale(0, 0, source.width, source.height, outW, outH)
    val i420 = scaled.toI420() ?: run { scaled.release(); return null }

    try {
      val w = i420.width
      val h = i420.height
      val nv21 = ByteArray(w * h * 3 / 2)

      var idx = 0
      val y = i420.dataY
      for (row in 0 until h) {
        y.position(row * i420.strideY)
        y.get(nv21, idx, w)
        idx += w
      }

      // NV21 wants the chroma planes interleaved as V,U.
      val cw = (w + 1) / 2
      val ch = (h + 1) / 2
      val uRow = ByteArray(cw)
      val vRow = ByteArray(cw)
      val u = i420.dataU
      val v = i420.dataV
      for (row in 0 until ch) {
        u.position(row * i420.strideU)
        u.get(uRow, 0, cw)
        v.position(row * i420.strideV)
        v.get(vRow, 0, cw)
        for (col in 0 until cw) {
          nv21[idx++] = vRow[col]
          nv21[idx++] = uRow[col]
        }
      }

      val out = ByteArrayOutputStream()
      YuvImage(nv21, ImageFormat.NV21, w, h, null).compressToJpeg(Rect(0, 0, w, h), quality, out)
      val jpeg = out.toByteArray()

      // A phone held upright reports a rotation the raw buffer hasn't had applied. Sending it unrotated gives
      // Gemini a sideways scene and noticeably worse descriptions, so straighten it before it goes out.
      return if (frame.rotation != 0) rotate(jpeg, frame.rotation, quality) else jpeg
    } finally {
      i420.release()
      scaled.release()
    }
  }

  private fun rotate(jpeg: ByteArray, degrees: Int, quality: Int): ByteArray {
    val bitmap = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: return jpeg
    return try {
      val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
      val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
      val out = ByteArrayOutputStream()
      rotated.compress(Bitmap.CompressFormat.JPEG, quality, out)
      rotated.recycle()
      out.toByteArray()
    } catch (e: Throwable) {
      Log.w(TAG, "rotation failed, sending the frame as captured", e)
      jpeg
    } finally {
      bitmap.recycle()
    }
  }

  companion object {
    const val TAG = "QbFrames"
    const val NAME = "qb-frames"

    // Read by JavaScript between captures; written on the capture thread.
    @Volatile
    var latestJpeg: ByteArray? = null

    @Volatile
    var intervalMs: Long = 900

    @Volatile
    var maxWidth: Int = 640

    @Volatile
    var quality: Int = 60

    @Volatile
    private var lastCaptureMs: Long = 0

    fun reset() {
      latestJpeg = null
      lastCaptureMs = 0
    }
  }

  class Factory : VideoFrameProcessorFactoryInterface {
    override fun build(): VideoFrameProcessor = FrameTap()
  }
}
