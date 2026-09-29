import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { OUTLET } from '../data/menu'
import { BillDetails } from '../components/disguise/BillDetails'
import { PageHeader } from '../components/disguise/PageHeader'
import { QtyStepper } from '../components/disguise/QtyStepper'
import { VegMark } from '../components/disguise/icons'
import { computeBill, formatRupees, useCart } from '../state/cart'
import { colors, radius, shadowBar, shadowCard } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/pages/CartPage.tsx.
export function CartScreen() {
  const nav = useNavigation<Nav>()
  const cart = useCart()

  if (cart.count === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <PageHeader title="Cart" backTo="Home" />
        <View style={styles.empty}>
          <Text style={styles.emptyArt}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Good food is always cooking. Go ahead, order some yummy items from the menu.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => nav.navigate('Home')}>
            <Text style={styles.primaryText}>Browse menu</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const total = computeBill(cart.subtotal).total

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <PageHeader title={OUTLET.name} subtitle={`${OUTLET.area} · ${OUTLET.eta}`} backTo="Home" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {cart.lines.map(({ item, qty }) => (
            <View key={item.id} style={styles.line}>
              <VegMark veg={item.veg} />
              <View style={styles.lineName}>
                <Text style={styles.lineTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.lineUnit}>{item.price === 0 ? 'Free' : formatRupees(item.price)}</Text>
              </View>
              <QtyStepper
                size="sm"
                qty={qty}
                onInc={() => cart.add(item.id)}
                onDec={() => cart.decrement(item.id)}
              />
              <Text style={styles.linePrice}>
                {item.price === 0 ? 'Free' : formatRupees(item.price * qty)}
              </Text>
            </View>
          ))}

          <Pressable onPress={() => nav.navigate('Home')} hitSlop={6}>
            <Text style={styles.addMore}>+ Add more items</Text>
          </Pressable>
        </View>

        <BillDetails subtotal={cart.subtotal} />

        <Text style={styles.policy}>
          Review your order and address details to avoid cancellations. Orders cannot be cancelled once packed for
          delivery.
        </Text>
      </ScrollView>

      <View style={styles.bar}>
        <Pressable style={styles.checkoutBar} onPress={() => nav.navigate('Checkout')}>
          <View>
            <Text style={styles.checkoutStrong}>{formatRupees(total)}</Text>
            <Text style={styles.checkoutSub}>Total</Text>
          </View>
          <Text style={styles.checkoutCta}>Proceed to checkout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyArt: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  primaryBtn: {
    marginTop: 12,
    paddingHorizontal: 26,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
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
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  lineName: { flex: 1 },
  lineTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  lineUnit: { fontSize: 11, color: colors.muted, marginTop: 1 },
  linePrice: { fontSize: 13, fontWeight: '700', color: colors.ink, minWidth: 58, textAlign: 'right' },
  addMore: { color: colors.accentDark, fontWeight: '700', fontSize: 13, paddingTop: 10 },
  policy: { fontSize: 11, color: colors.muted, paddingHorizontal: 16, paddingVertical: 16, lineHeight: 16 },
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
