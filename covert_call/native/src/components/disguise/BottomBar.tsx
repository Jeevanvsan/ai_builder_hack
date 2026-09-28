import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../../App'
import { formatRupees, useCart } from '../../state/cart'
import { colors, radius, shadowBar } from '../../theme'
import { ChevronRightIcon, PhoneIcon } from './icons'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/components/disguise/BottomBar.tsx.
//
// Home is the only fork point: calling, silent reporting, and checkout are three separate forks, never a
// sequence — offered only while the cart is empty so none of them can ever belong to the same order. (The
// earlier native scaffold showed "Delivery instructions" even with items in the cart, which broke that rule.)
// "Delivery instructions" is the silent-tap mode's disguise: an ordinary thing to tap on a food app.
export function BottomBar() {
  const nav = useNavigation<Nav>()
  const cart = useCart()

  if (cart.count > 0) {
    return (
      <View style={styles.bar}>
        <Pressable style={styles.cartBar} onPress={() => nav.navigate('Cart')}>
          <View>
            <Text style={styles.cartStrong}>
              {cart.count} item{cart.count > 1 ? 's' : ''}
            </Text>
            <Text style={styles.cartSub}>{formatRupees(cart.subtotal)} plus taxes</Text>
          </View>
          <View style={styles.cartCta}>
            <Text style={styles.cartCtaText}>View cart</Text>
            <ChevronRightIcon size={17} />
          </View>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.bar}>
      <View style={styles.guestBar}>
        <View style={styles.guestCopy}>
          <Text style={styles.guestStrong}>Ordering as guest</Text>
          <Pressable onPress={() => nav.navigate('SilentTap')} hitSlop={6}>
            <Text style={styles.guestLink}>Delivery instructions</Text>
          </Pressable>
        </View>
        <Pressable style={styles.callCta} onPress={() => nav.navigate('Call')}>
          <PhoneIcon size={15} />
          <Text style={styles.callText}>Call to order</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    ...shadowBar,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartStrong: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cartSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2 },
  cartCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartCtaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  guestBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  guestCopy: { flex: 1 },
  guestStrong: { fontSize: 13, fontWeight: '700', color: colors.ink },
  // Deliberately low-key: it should read as fine print, not as a call to action.
  guestLink: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline', marginTop: 2 },
  callCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callText: { color: '#fff', fontWeight: '800', fontSize: 13 },
})
