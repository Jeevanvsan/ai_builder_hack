import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { formatRupees } from '../data/menu'
import { useCart } from '../state/cart'
import { colors, radius } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CartScreen() {
  const nav = useNavigation<Nav>()
  const cart = useCart()

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Cart</Text>
      {cart.lines.map(({ item, qty }) => (
        <View key={item.id} style={styles.line}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.qty}>
            <Pressable onPress={() => cart.decrement(item.id)} hitSlop={8}><Text style={styles.step}>–</Text></Pressable>
            <Text style={styles.qtyNum}>{qty}</Text>
            <Pressable onPress={() => cart.add(item.id)} hitSlop={8}><Text style={styles.step}>+</Text></Pressable>
          </View>
          <Text style={styles.price}>{item.price === 0 ? 'Free' : formatRupees(item.price * qty)}</Text>
        </View>
      ))}
      {cart.count === 0 && <Text style={styles.empty}>Your cart is empty.</Text>}

      <View style={styles.bottomBar}>
        <Pressable style={styles.btn} disabled={cart.count === 0} onPress={() => nav.navigate('Checkout')}>
          <Text style={styles.btnText}>{formatRupees(cart.subtotal)} · Proceed to checkout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  line: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.line },
  name: { flex: 1, color: colors.ink, fontWeight: '600' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12 },
  step: { fontSize: 20, color: colors.accent, fontWeight: '800' },
  qtyNum: { fontSize: 15, color: colors.ink },
  price: { color: colors.ink, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  empty: { color: colors.muted },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  btn: { backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
})
