import { ImageBackground, StyleSheet, Text, View } from 'react-native'
import { BANNER_IMAGE, OUTLET } from '../../data/menu'
import { FREE_DELIVERY_THRESHOLD } from '../../state/cart'
import { colors, radius } from '../../theme'
import { ClockIcon, StarIcon } from './icons'

// Native port of web/src/components/disguise/PromoBanner.tsx.
export function PromoBanner() {
  return (
    <View style={styles.wrap}>
      <ImageBackground source={BANNER_IMAGE} style={styles.card} imageStyle={styles.cardImage}>
        <View style={styles.scrim} />
        <Text style={styles.badge}>TODAY ONLY</Text>
        <View style={styles.copy}>
          <Text style={styles.copyStrong}>Free delivery over ₹{FREE_DELIVERY_THRESHOLD}</Text>
          <Text style={styles.copySub}>Hot &amp; fresh at your door in {OUTLET.eta}</Text>
        </View>
      </ImageBackground>

      <View style={styles.outlet}>
        <View style={styles.outletMain}>
          <Text style={styles.outletName}>{OUTLET.name}</Text>
          <Text style={styles.outletSub}>
            {OUTLET.cuisines} · {OUTLET.area}
          </Text>
        </View>
        <View style={styles.outletMeta}>
          <View style={styles.ratingChip}>
            <StarIcon size={11} color="#fff" />
            <Text style={styles.ratingText}>{OUTLET.rating}</Text>
          </View>
          <View style={styles.eta}>
            <ClockIcon size={12} />
            <Text style={styles.etaText}>{OUTLET.eta}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  card: { height: 140, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', padding: 14 },
  cardImage: { borderRadius: radius.lg },
  // The photo alone doesn't guarantee readable text, so a dark scrim sits between it and the copy.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,26,22,0.42)' },
  badge: {
    position: 'absolute',
    top: 12,
    left: 14,
    backgroundColor: colors.accent,
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  copy: { gap: 2 },
  copyStrong: { color: '#fff', fontSize: 18, fontWeight: '800' },
  copySub: { color: 'rgba(255,255,255,0.92)', fontSize: 12 },
  outlet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, gap: 12 },
  outletMain: { flex: 1 },
  outletName: { fontSize: 19, fontWeight: '800', color: colors.ink },
  outletSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  outletMeta: { alignItems: 'flex-end', gap: 4 },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.rating,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  eta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  etaText: { fontSize: 11, color: colors.muted },
})
