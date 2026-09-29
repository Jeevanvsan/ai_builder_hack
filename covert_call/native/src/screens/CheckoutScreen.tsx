import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { DELIVERY_ADDRESS, OUTLET } from '../data/menu'
import { BillDetails } from '../components/disguise/BillDetails'
import { PageHeader } from '../components/disguise/PageHeader'
import { ClockIcon, HomeIcon, WalletIcon } from '../components/disguise/icons'
import { computeBill, formatRupees, useCart } from '../state/cart'
import { db } from '../lib/firebase'
import { decodeOrder } from '../../../shared/codes'
import { startIncident, updateLiveFields } from '../../../shared/incidents/client'
import type { Severity } from '../../../shared/incidents/types'
import { colors, radius, shadowBar, shadowCard } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Payment = 'cod' | 'upi'

const PAYMENT_OPTIONS: { id: Payment; label: string; hint: string }[] = [
  { id: 'cod', label: 'Cash on delivery', hint: 'Pay in cash when your order arrives' },
  { id: 'upi', label: 'UPI on delivery', hint: 'Scan and pay with any UPI app at your door' },
]

// The delivery-speed choice doubles as the urgency signal for a coded "click & order" (Epic 8, Story 8.2):
// an ordinary-looking "how soon do you want it" maps straight to how urgently a responder should act.
const DELIVERY_OPTIONS: { id: Severity; label: string; hint: string }[] = [
  { id: 'low', label: 'Standard', hint: 'Arrives in 30–40 min' },
  { id: 'medium', label: 'Priority', hint: 'Bumped up the queue, ~20 min' },
  { id: 'high', label: 'As soon as possible', hint: 'Fastest available rider' },
]

// Native port of web/src/pages/CheckoutPage.tsx.
export function CheckoutScreen() {
  const nav = useNavigation<Nav>()
  const cart = useCart()
  const [payment, setPayment] = useState<Payment>('cod')
  const [deliveryUrgency, setDeliveryUrgency] = useState<Severity>('low')
  const [placing, setPlacing] = useState(false)

  // The web renders <Navigate to="/" replace> for an empty cart. React Navigation has no render-time redirect,
  // so it runs as an effect instead — the guard itself matters (an empty cart must never reach "Place order").
  const empty = cart.count === 0
  useEffect(() => {
    if (empty && !placing) nav.reset({ index: 0, routes: [{ name: 'Home' }] })
  }, [empty, placing, nav])
  if (empty) return null

  const total = computeBill(cart.subtotal).total

  // Placing the order: a normal order just clears the cart and shows confirmation. If the cart carries any coded
  // items, it silently raises a decoded incident first — nothing on screen differs between the two, so a normal
  // customer and a person in danger see the identical "order placed" flow.
  const placeOrder = async () => {
    if (placing) return
    setPlacing(true)
    const codedLines = cart.lines
      .filter((l) => l.item.code)
      .map((l) => ({ codeId: l.item.code as string, qty: l.qty }))

    let incidentId: string | null = null
    if (codedLines.length > 0) {
      try {
        const decoded = decodeOrder(codedLines, deliveryUrgency)
        const { id } = await startIncident(db, { channel: 'click-order' })
        incidentId = id
        await updateLiveFields(db, id, {
          dangerIndicators: decoded.dangerIndicators,
          peopleCount: decoded.peopleCount,
          urgency: decoded.urgency,
          notes: decoded.notes,
        })
      } catch {
        // Best-effort: never let a failed write leave the person stuck on a checkout screen that won't complete —
        // the order-placed screen must always appear so the disguise holds.
      }
    }

    // Pass the incident id so the order-tracking screen can mirror the responder's progress in disguise (8.3).
    nav.reset({ index: 0, routes: [{ name: 'OrderPlaced', params: incidentId ? { incidentId } : undefined }] })
    cart.clear()
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <PageHeader
        title="Checkout"
        subtitle={`${cart.count} item${cart.count > 1 ? 's' : ''} · ${OUTLET.name}`}
        backTo="Cart"
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <HomeIcon size={19} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoStrong}>Deliver to {DELIVERY_ADDRESS.label}</Text>
              <Text style={styles.infoSub}>{DELIVERY_ADDRESS.line}</Text>
            </View>
            <Text style={styles.linkBtn}>Change</Text>
          </View>
          <View style={styles.infoRow}>
            <ClockIcon size={19} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoStrong}>Delivery in {OUTLET.eta}</Text>
              <Text style={styles.infoSub}>Standard delivery</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery time</Text>
          {DELIVERY_OPTIONS.map((d) => {
            const selected = deliveryUrgency === d.id
            return (
              <Pressable
                key={d.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setDeliveryUrgency(d.id)}
              >
                <ClockIcon size={19} />
                <View style={styles.infoCopy}>
                  <Text style={styles.infoStrong}>{d.label}</Text>
                  <Text style={styles.infoSub}>{d.hint}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment method</Text>
          {PAYMENT_OPTIONS.map((p) => {
            const selected = payment === p.id
            return (
              <Pressable
                key={p.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setPayment(p.id)}
              >
                <WalletIcon size={19} />
                <View style={styles.infoCopy}>
                  <Text style={styles.infoStrong}>{p.label}</Text>
                  <Text style={styles.infoSub}>{p.hint}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            )
          })}
        </View>

        <BillDetails subtotal={cart.subtotal} />
        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.bar}>
        <Pressable style={styles.checkoutBar} disabled={placing} onPress={() => void placeOrder()}>
          <View>
            <Text style={styles.checkoutStrong}>{formatRupees(total)}</Text>
            <Text style={styles.checkoutSub}>{payment === 'cod' ? 'Cash on delivery' : 'UPI on delivery'}</Text>
          </View>
          <Text style={styles.checkoutCta}>{placing ? 'Placing…' : 'Place order'}</Text>
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
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  infoCopy: { flex: 1 },
  infoStrong: { fontSize: 13, fontWeight: '700', color: colors.ink },
  infoSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  linkBtn: { fontSize: 12, fontWeight: '700', color: colors.accentDark },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    marginTop: 6,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    ...shadowBar,
  },
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  checkoutStrong: { color: '#fff', fontWeight: '800', fontSize: 15 },
  checkoutSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 1 },
  checkoutCta: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
