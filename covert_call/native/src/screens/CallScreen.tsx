import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { db } from '../lib/firebase'
import { startIncident, endIncident } from '../../../shared/incidents/client'
import { useAppearance } from '../lib/appearance'
import { colors } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Live-call screen (Epic 12.2). This scaffold creates the incident and renders the call UI, but the Gemini Live
// audio/video transport is NOT wired yet on native — see src/lib/nativeCall.ts for exactly what remains. On a real
// build, replace the timer-only placeholder with startNativeCall() so the persona conversation + extraction run.
export function CallScreen() {
  const nav = useNavigation<Nav>()
  const { name } = useAppearance()
  const idRef = useRef<string | null>(null)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    void startIncident(db, { channel: 'live-call' }).then(({ id }) => { idRef.current = id })
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const end = () => {
    if (idRef.current) void endIncident(db, idRef.current)
    nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.avatar}><Text style={styles.avatarText}>QB</Text></View>
        <Text style={styles.title}>{name} Order Desk</Text>
        <Text style={styles.timer}>{mm}:{ss}</Text>
        <Text style={styles.note}>Native voice wiring pending (see nativeCall.ts)</Text>
      </View>
      <View style={styles.controls}>
        <Pressable style={[styles.btn, styles.end]} onPress={end}>
          <Text style={styles.endText}>End</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#151315', justifyContent: 'space-between' },
  top: { alignItems: 'center', marginTop: 80 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#2c2926', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#f4efe6', fontSize: 24, fontWeight: '800' },
  title: { color: '#f4efe6', fontSize: 20, fontWeight: '700', marginTop: 16 },
  timer: { color: '#a89f8c', fontSize: 16, marginTop: 8 },
  note: { color: '#6b6357', fontSize: 11, marginTop: 24, paddingHorizontal: 24, textAlign: 'center' },
  controls: { alignItems: 'center', marginBottom: 60 },
  btn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 40 },
  end: { backgroundColor: colors.danger },
  endText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
