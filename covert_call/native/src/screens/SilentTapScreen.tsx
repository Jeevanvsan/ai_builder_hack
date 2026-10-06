import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import type { RootStackParamList } from '../../App'
import { PageHeader } from '../components/disguise/PageHeader'
import { db } from '../lib/firebase'
import { analyzePhoto } from '../lib/gemini/photoVision'
import {
  startIncident,
  updateLiveFields,
  confirmAddress,
  reportSceneObservation,
  endIncident,
} from '../../../shared/incidents/client'
import type { Severity } from '../../../shared/incidents/types'
import { colors, radius, shadowBar, shadowCard } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/pages/SilentTapPage.tsx.
//
// Each visible option is an ordinary "delivery instruction" — its real meaning only appears on press-and-hold, so
// nothing here relies on the caller having memorized anything before opening this screen (same design intent as
// the live-teaching rule for the call flow, applied to a silent/no-audio context instead of speech).
type Option = {
  id: string
  label: string
  realMeaning: string
  indicator?: string
  urgency?: Severity
}

// Labels, meanings and indicator strings are copied verbatim from the web. They must stay identical: the
// dashboard's severity and negation logic matches on these exact strings, so a drifted wording (the earlier
// native scaffold said "weapon present" where the web says "weapon mentioned") changes how a case is ranked.
const OPTIONS: Option[] = [
  { id: 'ring-bell', label: 'Ring the bell', realMeaning: "Everything's fine right now" },
  { id: 'leave-door', label: 'Leave at the door', realMeaning: 'I need help but no immediate danger — low urgency', urgency: 'low' },
  { id: 'call-on-arrival', label: 'Call on arrival', realMeaning: 'Someone else is with me and may be a threat', indicator: 'aggressor present', urgency: 'medium' },
  { id: 'fragile', label: 'Handle with care — fragile', realMeaning: 'Someone is injured', indicator: 'injury', urgency: 'medium' },
  { id: 'no-contact', label: "Don't ring, leave silently", realMeaning: 'A weapon is present — send help urgently', indicator: 'weapon mentioned', urgency: 'high' },
]

function OptionButton({ option, onSelect, selected }: { option: Option; onSelect: () => void; selected: boolean }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onSelect}
      // 500 ms, as on the web. The meaning is only ever on screen while the finger is held down.
      delayLongPress={500}
      onLongPress={() => setRevealed(true)}
      onPressOut={() => setRevealed(false)}
    >
      <Text style={styles.optionLabel}>{option.label}</Text>
      {revealed && <Text style={styles.optionMeaning}>{option.realMeaning}</Text>}
    </Pressable>
  )
}

export function SilentTapScreen() {
  const nav = useNavigation<Nav>()
  const incidentIdRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [ready, setReady] = useState(false)
  const [photoState, setPhotoState] = useState<'idle' | 'analysing' | 'attached' | 'failed'>('idle')
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void startIncident(db, { channel: 'silent-tap' }).then(({ id }) => {
      incidentIdRef.current = id
      setReady(true)
    })
  }, [])

  // Attach a photo (Epic 6.1): Gemini reads it into structured signal and merges it into the incident. Styled as
  // an ordinary "add a photo for the rider" affordance. The raw image isn't stored — only the AI's read of it.
  const onPhoto = async () => {
    const id = incidentIdRef.current
    if (!id || photoState === 'analysing') return

    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setPhotoState('failed')
      return
    }

    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.4, exif: false })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset?.base64) {
      setPhotoState('failed')
      return
    }

    setPhotoState('analysing')
    try {
      const analysis = await analyzePhoto({ base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' })
      await updateLiveFields(db, id, {
        dangerIndicators: analysis.dangerIndicators,
        urgency: analysis.urgency,
        notes: `Photo: ${analysis.summary}`,
      })
      for (const obs of analysis.observations) {
        await reportSceneObservation(db, id, { source: 'camera', kind: 'photo', detail: obs })
      }
      setPhotoState('attached')
    } catch {
      setPhotoState('failed')
    }
  }

  const toggleOption = (option: Option) => {
    const id = incidentIdRef.current
    if (!id) return
    const next = new Set(selected)
    if (next.has(option.id)) next.delete(option.id)
    else next.add(option.id)
    setSelected(next)

    const chosen = OPTIONS.filter((o) => next.has(o.id))
    const dangerIndicators = chosen.map((o) => o.indicator).filter((v): v is string => Boolean(v))
    const urgencies = chosen.map((o) => o.urgency).filter((v): v is Severity => Boolean(v))
    const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 }
    const urgency = urgencies.length ? urgencies.reduce((a, b) => (rank[a] >= rank[b] ? a : b)) : null

    void updateLiveFields(db, id, { dangerIndicators, urgency })
  }

  const submit = async () => {
    const id = incidentIdRef.current
    if (!id) return
    if (note.trim()) await updateLiveFields(db, id, { notes: note.trim() })
    if (address.trim()) await confirmAddress(db, id, address.trim())
    // The web's zeroTraceExit: end the incident and return home with no way back into this screen. A stack reset
    // is the native equivalent of navigate('/', { replace: true }).
    void endIncident(db, id)
    nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }

  const photoLabel =
    photoState === 'analysing'
      ? 'Uploading photo…'
      : photoState === 'attached'
        ? 'Photo added ✓'
        : photoState === 'failed'
          ? 'Couldn’t add photo — tap to retry'
          : 'Choose a photo'

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <PageHeader title="Delivery instructions" subtitle="Help our rider find you" backTo="Home" />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Any special instructions?</Text>
          <Text style={styles.hint}>Tap to select. Press and hold any option to see more detail.</Text>
          {OPTIONS.map((option) => (
            <OptionButton
              key={option.id}
              option={option}
              selected={selected.has(option.id)}
              onSelect={() => toggleOption(option)}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Confirm your address"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a photo</Text>
          <Text style={styles.hint}>Optional — a picture to help the rider find you.</Text>
          <Pressable style={styles.option} onPress={() => void onPhoto()}>
            <Text style={styles.optionLabel}>{photoLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Note for rider</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={note}
            onChangeText={setNote}
            placeholder="Anything else the rider should know"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.bar}>
        {/* Disabled until the incident exists, so a tap can never silently do nothing (A10.7). */}
        <Pressable
          style={[styles.submitBar, !ready && styles.submitDisabled]}
          disabled={!ready}
          onPress={() => void submit()}
        >
          <Text style={styles.submitText}>Save instructions</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadowCard,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 11, color: colors.muted, marginTop: 4, marginBottom: 4 },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionLabel: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  optionMeaning: { fontSize: 12, color: colors.accentDark, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    color: colors.ink,
    fontSize: 13,
    backgroundColor: colors.surface,
  },
  textarea: { minHeight: 76 },
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    ...shadowBar,
  },
  submitBar: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
