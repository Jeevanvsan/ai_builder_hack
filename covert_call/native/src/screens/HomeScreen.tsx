import { useRef } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { MENU, formatRupees, DELIVERY_ADDRESS } from '../data/menu'
import { useCart } from '../state/cart'
import { useAppearance } from '../lib/appearance'
import { colors, radius } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function HomeScreen() {
  const nav = useNavigation<Nav>()
  const cart = useCart()
  const { name } = useAppearance()

  // Double-tap the heart to trigger the silent SOS (Epic 11.1). A single tap does nothing unusual.
  const lastTap = useRef(0)
  const onHeart = () => {
    const now = Date.now()
    if (now - lastTap.current < 400) {
      lastTap.current = 0
      nav.navigate('Sos')
    } else {
      lastTap.current = now
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.brand}>{name}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="Favourites" onPress={onHeart} hitSlop={8}>
            <Text style={styles.icon}>♡</Text>
          </Pressable>
          <Pressable accessibilityLabel="Account" onPress={() => nav.navigate('Settings')} hitSlop={8}>
            <Text style={styles.icon}>☰</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.address}>Deliver to {DELIVERY_ADDRESS.label} · {DELIVERY_ADDRESS.line}</Text>

      <FlatList
        data={MENU}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDesc}>{item.description}</Text>
              <Text style={styles.itemPrice}>{item.price === 0 ? 'Free' : formatRupees(item.price)}</Text>
            </View>
            <Pressable style={styles.addBtn} onPress={() => cart.add(item.id)}>
              <Text style={styles.addBtnText}>{cart.qtyOf(item.id) > 0 ? `${cart.qtyOf(item.id)} +` : 'ADD'}</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.bottomBar}>
        <Pressable style={[styles.barBtn, styles.barGhost]} onPress={() => nav.navigate('SilentTap')}>
          <Text style={styles.barGhostText}>Delivery instructions</Text>
        </Pressable>
        {cart.count > 0 ? (
          <Pressable style={styles.barBtn} onPress={() => nav.navigate('Cart')}>
            <Text style={styles.barText}>View cart ({cart.count})</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.barBtn} onPress={() => nav.navigate('Call')}>
            <Text style={styles.barText}>Call to order</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  brand: { fontSize: 20, fontWeight: '800', color: colors.accent },
  actions: { flexDirection: 'row', gap: 16 },
  icon: { fontSize: 22, color: colors.ink },
  address: { paddingHorizontal: 16, paddingTop: 6, color: colors.muted, fontSize: 12 },
  item: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.line },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  itemDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 6 },
  addBtn: { alignSelf: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: colors.accent, fontWeight: '700' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.surface },
  barBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 14, alignItems: 'center' },
  barText: { color: '#fff', fontWeight: '700' },
  barGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  barGhostText: { color: colors.ink, fontWeight: '600' },
})
