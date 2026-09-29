import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useKeepAwake } from 'expo-keep-awake'
import type { RootStackParamList } from '../../App'
import { db } from '../lib/firebase'
import { startIncident, endIncident, updateLiveFields } from '../../../shared/incidents/client'
import { startVideoPublisher } from '../../../shared/video/publisher'
import { startLiveCall, type CallStatus, type LiveCallHandle, type CallRecording } from '../lib/gemini/liveSession'
import { runPostSessionPasses, uploadCallAudio } from '../lib/gemini/postSession'
import { acquireCallCamera, stopStream, type RtcStream } from '../lib/platform/camera'
import { ensureCapturePermissions } from '../lib/platform/permissions'
import { routeCallToEarpiece, releaseCallAudio } from '../lib/platform/audioRoute'
import { watchCameraSwitchRequests, type CameraSwitchWatcher } from '../lib/platform/cameraControl'
import { startFrameTap, type FrameSource } from '../../modules/qb-frames'
import { useAppearance } from '../lib/appearance'
import { useCart } from '../state/cart'
import { MicIcon, MicOffIcon, PhoneIcon, SpeakerIcon } from '../components/disguise/icons'
import { colors } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/pages/CallPage.tsx.
const STATUS_LABEL: Record<CallStatus, string> = {
  connecting: 'Connecting…',
  live: 'Connected',
  ended: 'Call ended',
  failed: "Couldn't connect",
}

export function CallScreen() {
  useKeepAwake() // A call can run for many minutes untouched; don't let the screen lock and pause the mic.
  const nav = useNavigation<Nav>()
  const cart = useCart()
  const { name } = useAppearance()

  const [status, setStatus] = useState<CallStatus>('connecting')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const incidentIdRef = useRef<string | null>(null)
  const callRef = useRef<LiveCallHandle | null>(null)
  // Back-camera feed to the dashboard (Epic 9). Optional throughout: no camera, or a refused permission, just
  // means the call runs audio-only.
  const cameraRef = useRef<RtcStream | null>(null)
  const publisherStopRef = useRef<(() => Promise<void>) | null>(null)
  const cameraWatcherRef = useRef<CameraSwitchWatcher | null>(null)
  // The cart as it was when this screen opened. Later changes must not retrigger setup.
  const cartHadItemsOnMount = useRef(cart.count > 0)
  const startedRef = useRef(false)
  // finishCall is reached from three places (the End button, the model's own end_call, and a dropped
  // connection) — whichever fires first wins and the rest are no-ops.
  const endingRef = useRef(false)
  const finishCallRef = useRef<(opts?: { dropped?: boolean }) => void>(() => {})

  useEffect(() => {
    // A call must never belong to an order: with items in the cart, go back to the cart instead of starting one.
    if (cartHadItemsOnMount.current) {
      nav.reset({ index: 0, routes: [{ name: 'Cart' }] })
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      // Asked before anything tries to capture: neither the audio library nor the camera raised Android's
      // dialog on its own, so the first real call failed silently until the permissions were set by hand.
      const permissions = await ensureCapturePermissions()

      const { id } = await startIncident(db, { channel: 'live-call' })
      incidentIdRef.current = id

      // The camera is opened before the session so Gemini can see from the first turn rather than joining late.
      // Entirely optional: a refused permission or a device without a camera just means an audio-only call.
      let frames: FrameSource | null = null
      try {
        if (permissions.camera) {
          const camera = await acquireCallCamera()
          cameraRef.current = camera
          if (camera) frames = startFrameTap(camera)
        }
      } catch (e) {
        console.error('[QuickBite call] camera unavailable — continuing audio-only:', e)
      }

      try {
        callRef.current = await startLiveCall(
          db,
          id,
          {
            onStatusChange: setStatus,
            onCallEnd: () => finishCallRef.current(),
            onCallDropped: () => finishCallRef.current({ dropped: true }),
          },
          { frames },
        )
      } catch {
        setStatus('failed')
      }

      // Applied only now. The echo-cancelling audio engine starts up inside startLiveCall and grabs the
      // loudspeaker as it does, so routing requested any earlier is simply overwritten (which is exactly what
      // happened on the first device test). routeCallToEarpiece re-applies a few times to outlast the engine's
      // own asynchronous device callbacks.
      routeCallToEarpiece()

      // Live feed for the responder. Separate from the stills above and equally best-effort — a blocked peer
      // connection costs the video tile, never the call.
      if (cameraRef.current) {
        try {
          publisherStopRef.current = await startVideoPublisher(db, id, cameraRef.current, { camera: 'back' })
          cameraWatcherRef.current = watchCameraSwitchRequests(db, id, () => cameraRef.current)
        } catch (e) {
          console.error('[QuickBite call] live video publisher failed:', e)
        }
      }
    })()
  }, [nav])

  useEffect(() => {
    if (status !== 'live') return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [status])

  // `dropped: true` means the connection failed and every reconnect attempt gave up — not the caller saying
  // goodbye. Recorded as its own indicator so a responder can tell "cut off, possibly mid-emergency" apart from
  // a normal, confirmed-safe hangup; otherwise the case file reads identically either way.
  const finishCall = async (opts: { dropped?: boolean } = {}) => {
    if (endingRef.current) return
    endingRef.current = true

    const id = incidentIdRef.current
    const call = callRef.current
    const transcript = call?.getTranscript() ?? ''

    let recording: CallRecording | null = null
    try {
      recording = (await call?.end()) ?? null
    } catch {
      // Teardown is best-effort; the exit must happen regardless.
    }

    // Stops the feed (which also marks the video ended on the incident) and releases the camera.
    cameraWatcherRef.current?.stop()
    await publisherStopRef.current?.().catch(() => {})
    stopStream(cameraRef.current)
    cameraRef.current = null
    releaseCallAudio()

    setStatus('ended')

    if (!id) {
      nav.reset({ index: 0, routes: [{ name: 'Home' }] })
      return
    }

    if (opts.dropped) {
      void updateLiveFields(db, id, {
        dangerIndicators: ['call disconnected unexpectedly - not a confirmed hangup, reconnect attempts failed'],
        urgency: 'high',
        notes: 'The call dropped and could not reconnect. This is not the caller confirming they are safe.',
      })
    }

    // Capped internally at 8s so a slow model call can never hold the exit hostage.
    await runPostSessionPasses(db, id, transcript)

    // Uploaded in the background: leaving the screen must stay instant, and navigating away doesn't cancel it.
    if (recording) void uploadCallAudio(db, id, recording)

    // The web's zeroTraceExit: end the incident and return home with no way back into the call screen.
    void endIncident(db, id)
    nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }

  useEffect(() => {
    finishCallRef.current = (opts) => void finishCall(opts)
  })

  const toggleMute = () => {
    setMuted(callRef.current?.toggleMute() ?? !muted)
  }

  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{name} Order Desk</Text>
        <Text style={styles.status}>{status === 'live' ? `${minutes}:${secs}` : STATUS_LABEL[status]}</Text>
        {status === 'failed' && (
          <Pressable onPress={() => nav.reset({ index: 0, routes: [{ name: 'Home' }] })} hitSlop={8}>
            <Text style={styles.backLink}>Back to menu</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.btn, muted && styles.btnActive, status !== 'live' && styles.btnDisabled]}
          disabled={status !== 'live'}
          onPress={toggleMute}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
        </Pressable>

        <Pressable style={[styles.btn, styles.end]} onPress={() => void finishCall()} accessibilityLabel="End call">
          <PhoneIcon size={22} />
        </Pressable>

        {/* Present because a real call screen has one; audio already plays through the loudspeaker. */}
        <Pressable style={styles.btn} accessibilityLabel="Speaker">
          <SpeakerIcon size={20} />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.callBg, justifyContent: 'space-between' },
  top: { alignItems: 'center', marginTop: 80 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.callBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.callInk, fontSize: 24, fontWeight: '800' },
  title: { color: colors.callInk, fontSize: 20, fontWeight: '700', marginTop: 16 },
  status: { color: colors.callMuted, fontSize: 16, marginTop: 8 },
  backLink: { color: colors.callInk, fontSize: 13, marginTop: 18, textDecorationLine: 'underline' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22, marginBottom: 60 },
  btn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.callBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: '#494440' },
  btnDisabled: { opacity: 0.45 },
  end: { backgroundColor: colors.callEnd },
})
