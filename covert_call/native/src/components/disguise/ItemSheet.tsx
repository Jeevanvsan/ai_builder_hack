import { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MenuItem } from '../../data/menu'
import { CODE_BY_ID } from '../../../../shared/codes'
import { formatRupees, useCart } from '../../state/cart'
import { colors, radius } from '../../theme'
import { CloseIcon, StarIcon, VegMark } from './icons'
import { QtyStepper } from './QtyStepper'

// Native port of web/src/components/disguise/ItemSheet.tsx.
export function ItemSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const cart = useCart()
  const [qty, setQty] = useState(1)

  // Press and hold the image to reveal what a coded item really reports (Epic 8, Story 8.1). Ordinary items have
  // no code, so nothing is ever revealed for them and the disguise is untouched for a normal customer.
  const code = item.code ? CODE_BY_ID[item.code] : undefined
  const [revealed, setRevealed] = useState(false)

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stops a tap inside the sheet from closing it, the same role as the web's stopPropagation. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <CloseIcon size={16} />
          </Pressable>

          <ScrollView bounces={false}>
            <Pressable
              // 500 ms to match the web's press timer. onPressOut hides it again, so releasing early (or at all)
              // never leaves the real meaning on screen.
              delayLongPress={500}
              onLongPress={() => code && setRevealed(true)}
              onPressOut={() => setRevealed(false)}
            >
              <Image source={item.image} style={styles.image} resizeMode="cover" />
            </Pressable>

            {revealed && code && (
              <View style={styles.reveal}>
                <Text style={styles.revealText}>{code.meaning}</Text>
              </View>
            )}

            <View style={styles.body}>
              <View style={styles.tags}>
                <VegMark veg={item.veg} />
                {item.bestseller && <Text style={styles.bestseller}>★ Bestseller</Text>}
              </View>
              <Text style={styles.title}>{item.name}</Text>
              <View style={styles.meta}>
                <Text style={styles.price}>{item.price === 0 ? 'Free' : formatRupees(item.price)}</Text>
                {item.rating != null && (
                  <View style={styles.rating}>
                    <StarIcon size={11} />
                    <Text style={styles.ratingText}>
                      {item.rating} <Text style={styles.ratingCount}>({item.ratingCount} ratings)</Text>
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <QtyStepper qty={qty} onInc={() => setQty((q) => q + 1)} onDec={() => setQty((q) => Math.max(1, q - 1))} />
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                cart.add(item.id, qty)
                onClose()
              }}
            >
              <Text style={styles.primaryText}>
                Add item · {item.price === 0 ? 'Free' : formatRupees(item.price * qty)}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,26,22,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  image: { width: '100%', height: 210, backgroundColor: colors.backdrop },
  reveal: { backgroundColor: colors.accentSoft, paddingHorizontal: 16, paddingVertical: 10 },
  revealText: { color: colors.accentDark, fontSize: 13, fontWeight: '700' },
  body: { padding: 16 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bestseller: { fontSize: 10, fontWeight: '800', color: colors.bestseller, letterSpacing: 0.3 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  price: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: colors.rating, fontWeight: '700' },
  ratingCount: { color: colors.muted, fontWeight: '400' },
  desc: { fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  primaryBtn: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
