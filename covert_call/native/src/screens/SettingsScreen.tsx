import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { ICON_PRESETS, useAppearance } from '../lib/appearance'
import { colors, radius } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Disguise personalisation UI (Epic 13). Styled as an ordinary "App appearance" setting. The chosen name + icon
// are persisted (appearance.tsx) so they survive restarts.
export function SettingsScreen() {
  const nav = useNavigation<Nav>()
  const { name, iconId, setName, setIcon } = useAppearance()
  const [draftName, setDraftName] = useState(name)

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>App appearance</Text>

      <Text style={styles.section}>App name</Text>
      <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} onBlur={() => setName(draftName.trim() || 'QuickBite')} placeholder="App name" />
      <Text style={styles.note}>Shown throughout the app. On the home screen, the icon label can only be a preset name (Android) and can't change on iOS.</Text>

      <Text style={styles.section}>Icon</Text>
      <View style={styles.grid}>
        {ICON_PRESETS.map((p) => (
          <Pressable key={p.id} style={[styles.preset, iconId === p.id && styles.presetOn]} onPress={() => { setIcon(p.id); setName(p.label); setDraftName(p.label) }}>
            <Text style={styles.presetText}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.btn} onPress={() => nav.goBack()}>
        <Text style={styles.btnText}>Done</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  section: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 12, color: colors.ink },
  note: { color: colors.muted, fontSize: 12, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 12 },
  presetOn: { borderColor: colors.accent },
  presetText: { color: colors.ink, fontWeight: '600' },
  btn: { backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '700' },
})
