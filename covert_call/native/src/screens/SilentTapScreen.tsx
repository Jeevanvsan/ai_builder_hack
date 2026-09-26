import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { db } from '../lib/firebase'
import { startIncident, updateLiveFields, confirmAddress, endIncident } from '../../../shared/incidents/client'
import type { Severity } from '../../../shared/incidents/types'
import { colors, radius } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

type Option = { id: string; label: string; meaning: string; indicator?: string; urgency?: Severity }
const OPTIONS: Option[] = [
  { id: 'ring-bell', label: 'Ring the bell', meaning: "Everything's fine right now" },
  { id: 'leave-door', label: 'Leave at the door', meaning: 'I need help but no immediate danger', urgency: 'low' },
  { id: 'call-on-arrival', label: 'Call on arrival', meaning: 'Someone with me may be a threat', indicator: 'aggressor present', urgency: 'medium' },
  { id: 'fragile', label: 'Handle with care — fragile', meaning: 'Someone is injured', indicator: 'injury', urgency: 'medium' },
  { id: 'no-contact', label: "Don't ring, leave silently", meaning: 'A weapon is present — urgent', indicator: 'weapon present', urgency: 'high' },
]

// Silent tap-only report, ported from the web (Story 1.3). Long-press an option to reveal its meaning.
export function SilentTapScreen() {
  const nav = useNavigation<Nav>()
  const idRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    void startIncident(db, { channel: 'silent-tap' }).then(({ id }) => { idRef.current = id })
  }, [])

  const toggle = (opt: Option) => {
    const id = idRef.current
    if (!id) return
    const next = new Set(selected)
    if (next.has(opt.id)) next.delete(opt.id)
    else next.add(opt.id)
    setSelected(next)
    const chosen = OPTIONS.filter((o) => next.has(o.id))
    const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 }
    const urgencies = chosen.map((o) => o.urgency).filter((u): u is Severity => Boolean(u))
    void updateLiveFields(db, id, {
      dangerIndicators: chosen.map((o) => o.indicator).filter((v): v is string => Boolean(v)),
      urgency: urgencies.length ? urgencies.reduce((a, b) => (rank[a] >= rank[b] ? a : b)) : null,
    })
  }

  const submit = async () => {
    const id = idRef.current
    if (!id) return
    if (note.trim()) await updateLiveFields(db, id, { notes: note.trim() })
    if (address.trim()) await confirmAddress(db, id, address.trim())
    void endIncident(db, id)
    nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Delivery instructions</Text>
      <Text style={styles.hint}>Tap to select. Press and hold an option for more detail.</Text>
      {OPTIONS.map((o) => (
        <Pressable
          key={o.id}
          style={[styles.option, selected.has(o.id) && styles.optionOn]}
          onPress={() => toggle(o)}
          onLongPress={() => setRevealed(o.id)}
          onPressOut={() => setRevealed(null)}
        >
          <Text style={styles.optionLabel}>{o.label}</Text>
          {revealed === o.id && <Text style={styles.optionMeaning}>{o.meaning}</Text>}
        </Pressable>
      ))}
      <TextInput style={styles.input} placeholder="Confirm your address" value={address} onChangeText={setAddress} />
      <TextInput style={styles.input} placeholder="Note for rider" value={note} onChangeText={setNote} />
      <Pressable style={styles.btn} onPress={() => void submit()}>
        <Text style={styles.btnText}>Save instructions</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  hint: { color: colors.muted, fontSize: 12, marginVertical: 8 },
  option: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 14, marginBottom: 8 },
  optionOn: { borderColor: colors.accent },
  optionLabel: { color: colors.ink, fontWeight: '600' },
  optionMeaning: { color: colors.muted, fontStyle: 'italic', fontSize: 12, marginTop: 4 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 12, marginTop: 8, color: colors.ink },
  btn: { backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700' },
})
