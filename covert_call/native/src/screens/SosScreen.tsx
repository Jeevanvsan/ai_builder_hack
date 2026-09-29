import { useEffect, useRef } from 'react'
import { BackHandler, Pressable, StatusBar, StyleSheet, View } from 'react-native'
import { useKeepAwake } from 'expo-keep-awake'
import * as Brightness from 'expo-brightness'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { db } from '../lib/firebase'
import { startIncident, endIncident, setCameraMode } from '../../../shared/incidents/client'
import { startVideoPublisher } from '../../../shared/video/publisher'
import { startSilentObserver, type SilentObserverHandle } from '../lib/gemini/silentSession'
import { runPostSessionPasses, uploadCallAudio } from '../lib/gemini/postSession'
import { acquireSosCameras, stopStream, type RtcStream } from '../lib/platform/camera'
import { ensureCapturePermissions } from '../lib/platform/permissions'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/pages/SosPage.tsx.
//
// Reached only by double-tapping the heart on Home (Epic 11). Shows a full-black "the phone is off" overlay
// while a silent Gemini observer builds the incident from what the mic hears. The person leaves with a secret
// gesture: three taps anywhere on the screen within 1.5s.
//
// Still missing versus the web: camera-sourced observations. Gemini sees nothing here, because sampling ~1 fps
// JPEGs out of a WebRTC track needs a native frame source React Native doesn't provide. The live feeds below and
// every sound-based observation do work. The web's frozen-camera check is absent for the same reason — it
// compares two canvas samples, and there is no canvas.

// Caps any single teardown step so leaving can never hang: a slow Gemini close or a stuck upload would otherwise
// block the exit gesture, which is the one thing that must always work.
const TEARDOWN_STEP_TIMEOUT_MS = 3000
function withTimeout<T>(p: Promise<T>, fallback: T, ms = TEARDOWN_STEP_TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])
}

export function SosScreen() {
  useKeepAwake() // Screen stays on so the OS doesn't lock and pause the mic.
  const nav = useNavigation<Nav>()
  const startedRef = useRef(false)
  const endingRef = useRef(false)

  const incidentIdRef = useRef<string | null>(null)
  const observerRef = useRef<SilentObserverHandle | null>(null)
  const previousBrightnessRef = useRef<number | null>(null)
  // Every camera the phone will give us, each published as its own feed so a responder can switch between them.
  const streamsRef = useRef<RtcStream[]>([])
  const publisherStopsRef = useRef<(() => Promise<void>)[]>([])

  // Secret exit: three taps anywhere on the screen within 1.5s.
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      // Normally already answered during an ordinary call, so no dialog interrupts the black screen. If they
      // haven't been, asking here still beats capturing nothing at all.
      const permissions = await ensureCapturePermissions()

      // An SOS starts at high severity immediately, before anything is known.
      const { id } = await startIncident(db, {
        channel: 'silent-sos',
        incidentType: 'sos',
        scenario: 'hostage',
        severity: 'high',
      })
      incidentIdRef.current = id

      // Drop the backlight to its minimum so the screen reads as "off" in a dark room, not merely black. The
      // previous value is restored on exit. Best-effort: a refused permission just leaves it as it was.
      try {
        previousBrightnessRef.current = await Brightness.getBrightnessAsync()
        await Brightness.setBrightnessAsync(0)
      } catch {
        previousBrightnessRef.current = null
      }

      // Live video to the dashboard. Started before the observer so a responder can see the scene as early as
      // possible; each camera signals independently, so one failing doesn't stop the others.
      try {
        if (!permissions.camera) throw new Error('camera permission not granted')
        const { cameras, mode } = await acquireSosCameras()
        streamsRef.current = cameras.map((c) => c.stream)
        void setCameraMode(db, id, mode)
        console.log(`[QuickBite SOS] publishing cameras: ${cameras.map((c) => c.facing).join(', ') || 'none'}`)
        for (const cam of cameras) {
          try {
            publisherStopsRef.current.push(await startVideoPublisher(db, id, cam.stream, { camera: cam.facing }))
          } catch (e) {
            console.error(`[QuickBite SOS] live feed publisher failed for the ${cam.facing} camera:`, e)
          }
        }
      } catch (e) {
        console.error('[QuickBite SOS] camera acquisition failed — continuing audio-only:', e)
      }

      try {
        observerRef.current = await startSilentObserver(db, id)
      } catch (e) {
        // Previously this swallowed every failure (bad key, quota, network) with no logging, which was the main
        // reason repeated SOS tests showed "no transcript, no observations" with no way to tell why.
        console.error('[QuickBite SOS] silent observer failed to start — no AI observation this session:', e)
      }
    })()
  }, [])

  const endSos = async () => {
    if (endingRef.current) return
    endingRef.current = true

    const id = incidentIdRef.current
    const transcript = observerRef.current?.getTranscript() ?? ''
    const recording = await withTimeout(observerRef.current?.end() ?? Promise.resolve(null), null)
    await withTimeout(Promise.all(publisherStopsRef.current.map((stop) => stop().catch(() => {}))), [])
    streamsRef.current.forEach(stopStream)
    streamsRef.current = []

    if (previousBrightnessRef.current != null) {
      await Brightness.setBrightnessAsync(previousBrightnessRef.current).catch(() => {})
    }

    if (!id) {
      nav.reset({ index: 0, routes: [{ name: 'Home' }] })
      return
    }

    // Capped internally at 8s, so a slow model call can never hold a person on a black screen they're trying
    // to leave.
    await runPostSessionPasses(db, id, transcript)
    if (recording) void uploadCallAudio(db, id, recording)

    void endIncident(db, id)
    nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }

  // Android's back button would otherwise leave the SOS without ending the incident, stranding it 'active'.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [])

  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
  }, [])

  // The whole overlay listens — not just a corner — so the gesture works wherever on the dead-looking screen
  // the person happens to tap.
  const onExitTap = () => {
    tapCountRef.current += 1
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      void endSos()
      return
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0
    }, 1500)
  }

  return (
    <View style={styles.blackout}>
      {/* Hidden so the screen is genuinely black, with no clock or battery icon giving it away. */}
      <StatusBar hidden />
      <Pressable style={StyleSheet.absoluteFill} onPress={onExitTap} />
    </View>
  )
}

const styles = StyleSheet.create({
  blackout: { flex: 1, backgroundColor: '#000' },
})
