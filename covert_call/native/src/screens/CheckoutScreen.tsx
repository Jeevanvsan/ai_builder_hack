import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { formatRupees } from '../data/menu'
import { useCart } from '../state/cart'
import { db } from '../lib/firebase'
import { decodeOrder } from '../../../shared/codes'
import { startIncident, updateLiveFields } from '../../../shared/incidents/client'
import type { Severity } from '../../../shared/incidents/types'
import { colors, radius } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const DELIVERY: { id: Severity; label: string }[] = [
  { id: 'low', label: 'Standard · 30–40 min' },
  { id: 'medium', label: 'Priority · ~20 min' },
  { id: 'high', label: 'As soon as possible' },
]

// Mirrors the web CheckoutPage (Epic 8): a coded cart raises a decoded click-order incident, an ordinary cart
// doesn't. Both end on the identical order-placed screen.
export function CheckoutScreen() {
  const nav = useNavigation<Nav>()
  const cart = useCart()
  const [urgency, setUrgency] = useState<Severity>('low')
  const [placing, setPlacing] = useState(false)

  const placeOrder = async () => {
    if (placing) return
    setPlacing(true)
    const coded = cart.lines.filter((l) => l.item.code).map((l) => ({ codeId: l.item.code as string, qty: l.qty }))
    if (coded.length > 0) {
      try {
        const decoded = decodeOrder(coded, urgency)
        const { id } = await startIncident(db, { channel: 'click-order' })
        await updateLiveFields(db, id, {
          dangerIndicators: decoded.dangerIndicators,
          peopleCount: decoded.peopleCount,
          urgency: decoded.urgency,
          notes: decoded.notes,
        })
      } catch {
        // Best-effort: still show the order-placed screen so the disguise holds.
      }
    }
    cart.clear()
    nav.reset({ index: 0, routes: [{ name: 'OrderPlaced' }] })
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Checkout</Text>
      <Text style={styles.section}>Delivery time</Text>
      {DELIVERY.map((d) => (
        <Pressable key={d.id} style={[styles.option, urgency === d.id && styles.optionOn]} onPress={() => setUrgency(d.id)}>
          <Text style={styles.optionText}>{d.label}</Text>
        </Pressable>
      ))}

      <View style={styles.bottomBar}>
        <Pressable style={styles.btn} disabled={placing} onPress={() => void placeOrder()}>
          <Text style={styles.btnText}>{placing ? 'Placing…' : `${formatRupees(cart.subtotal)} · Place order`}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  section: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  option: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 14, marginBottom: 8 },
  optionOn: { borderColor: colors.accent },
  optionText: { color: colors.ink },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  btn: { backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
})
