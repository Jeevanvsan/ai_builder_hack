import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { MenuItem } from '../../data/menu'
import { formatRupees, useCart } from '../../state/cart'
import { colors, radius } from '../../theme'
import { StarIcon, VegMark } from './icons'
import { QtyStepper } from './QtyStepper'

// Native port of web/src/components/disguise/MenuItemCard.tsx.
export function MenuItemCard({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
  const cart = useCart()
  const qty = cart.qtyOf(item.id)

  return (
    <Pressable style={styles.card} onPress={() => onOpen(item)}>
      <View style={styles.info}>
        <View style={styles.tags}>
          <VegMark veg={item.veg} />
          {item.bestseller && <Text style={styles.bestseller}>★ Bestseller</Text>}
        </View>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{item.price === 0 ? 'Free' : formatRupees(item.price)}</Text>
        {item.rating != null && (
          <View style={styles.rating}>
            <StarIcon size={11} />
            <Text style={styles.ratingText}>
              {item.rating} <Text style={styles.ratingCount}>({item.ratingCount})</Text>
            </Text>
          </View>
        )}
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      <View style={styles.media}>
        <Image source={item.image} style={styles.image} resizeMode="cover" />
        <View style={styles.cta}>
          {qty > 0 ? (
            <QtyStepper qty={qty} onInc={() => cart.add(item.id)} onDec={() => cart.decrement(item.id)} />
          ) : (
            <Pressable style={styles.addBtn} onPress={() => cart.add(item.id)}>
              <Text style={styles.addText}>ADD</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  info: { flex: 1 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bestseller: { fontSize: 10, fontWeight: '800', color: colors.bestseller, letterSpacing: 0.3 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  price: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 4 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 12, color: colors.rating, fontWeight: '700' },
  ratingCount: { color: colors.muted, fontWeight: '400' },
  desc: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 17 },
  // The button overhangs the image's bottom edge, as on the web card.
  media: { width: 124, alignItems: 'center', paddingBottom: 16 },
  image: { width: 124, height: 106, borderRadius: radius.md, backgroundColor: colors.backdrop },
  cta: { position: 'absolute', bottom: 0 },
  addBtn: {
    paddingHorizontal: 26,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
  },
  addText: { color: colors.accentDark, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
})
