import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useKeepAwake } from 'expo-keep-awake'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { db } from '../lib/firebase'
import { startIncident, endIncident } from '../../../shared/incidents/client'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Silent SOS (Epic 11). Full-black "phone is off" overlay while recording continues. Reached only by
// double-tapping the heart on Home. Exit is three taps in the top-left corner.
//
// This scaffold creates the SOS incident, keeps the screen awake, and handles the black overlay + secret exit.
// The native AV pipeline (dual-camera capture, the WebRTC publisher via shared/video/publisher.ts, and the silent
// Gemini observer) is NOT wired here yet — it mirrors the web SosPage + silentSession.ts and needs the native
// camera/audio modules from nativeCall.ts. Wire it where marked.
export function SosScreen() {
  useKeepAwake() // Screen stays on so the OS doesn't lock and pause the camera/mic.
  const nav = useNavigation<Nav>()
  const startedRef = useRef(false)
  const idRef = useRef<string | null>(null)
  const taps = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void (async () => {
      const { id } = await startIncident(db, { channel: 'silent-sos', incidentType: 'sos', scenario: 'hostage', severity: 'high' })
      idRef.current = id
      // TODO (native, untested): acquire both cameras + mic, set cameraMode, start the WebRTC publisher for the
      //   back camera, start per-camera Drive recording, and start the silent Gemini observer — mirroring
      //   web/src/pages/SosPage.tsx + silentSession.ts. Enable lowest screen brightness here via expo-brightness.
    })()
  }, [])

  const exit = () => {
    if (idRef.current) void endIncident(db, idRef.current)
    nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }

  const onCornerTap = () => {
    taps.current += 1
    if (tapTimer.current) clearTimeout(tapTimer.current)
    if (taps.current >= 3) { taps.current = 0; exit(); return }
    tapTimer.current = setTimeout(() => { taps.current = 0 }, 1500)
  }

  return (
    <View style={styles.blackout}>
      {/* Invisible top-left hotspot: three taps within 1.5s exits. The rest of the screen ignores touches. */}
      <Pressable style={styles.hotspot} onPress={onCornerTap} />
    </View>
  )
}

const styles = StyleSheet.create({
  blackout: { flex: 1, backgroundColor: '#000' },
  hotspot: { position: 'absolute', top: 0, left: 0, width: 84, height: 84 },
})
