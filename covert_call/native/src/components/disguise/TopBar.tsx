import { useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../../App'
import { DELIVERY_ADDRESS } from '../../data/menu'
import { useAppearance } from '../../lib/appearance'
import { colors, radius } from '../../theme'
import { ChevronDownIcon, HeartIcon, PinIcon, UserIcon } from './icons'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/components/disguise/TopBar.tsx.
export function TopBar() {
  const nav = useNavigation<Nav>()
  const { name } = useAppearance()

  // Double-tapping the heart opens the silent SOS (Epic 11.1). A single tap does nothing, so the heart behaves
  // like an ordinary favourites button to anyone watching over the caller's shoulder. Same 400 ms window as web.
  const lastTapRef = useRef(0)
  const onHeartTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 400) {
      lastTapRef.current = 0
      nav.navigate('Sos')
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <View style={styles.topbar}>
      <View style={styles.row}>
        {/* Epic 25: a 2 s long-press on the logo starts a hidden demo call; a short press does nothing. */}
        <Pressable style={styles.brand} delayLongPress={2000} onLongPress={() => nav.navigate('Call', { demo: true })} android_disableSound>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>{name}</Text>
        </Pressable>
        <View style={styles.actions}>
          {/* No ripple/opacity feedback on purpose: the trigger must not look like it did anything (A2.4). */}
          <Pressable style={styles.iconBtn} onPress={onHeartTap} android_disableSound>
            <HeartIcon size={19} />
          </Pressable>
          <Pressable style={[styles.iconBtn, styles.avatar]} onPress={() => nav.navigate('Settings')}>
            <UserIcon size={16} />
          </Pressable>
        </View>
      </View>

      <View style={styles.addressPill}>
        <PinIcon size={13} />
        <Text style={styles.addressLabel}>{DELIVERY_ADDRESS.label}</Text>
        <Text style={styles.addressLine} numberOfLines={1}>
          {DELIVERY_ADDRESS.line}
        </Text>
        <ChevronDownIcon size={13} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topbar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  brandText: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  avatar: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  addressLabel: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  addressLine: { flex: 1, color: colors.muted, fontSize: 12 },
})
