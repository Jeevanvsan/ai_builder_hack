import { StyleSheet, Text, View } from 'react-native'
import { computeBill, formatRupees, FREE_DELIVERY_THRESHOLD } from '../../state/cart'
import { colors, radius, shadowCard } from '../../theme'

// Native port of web/src/components/disguise/BillDetails.tsx.
export function BillDetails({ subtotal }: { subtotal: number }) {
  const bill = computeBill(subtotal)
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Bill details</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Item total</Text>
        <Text style={styles.value}>{formatRupees(bill.subtotal)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Delivery fee</Text>
        {bill.deliveryFee === 0 ? (
          <Text style={styles.value}>
            <Text style={styles.struck}>₹39</Text> <Text style={styles.free}>FREE</Text>
          </Text>
        ) : (
          <Text style={styles.value}>{formatRupees(bill.deliveryFee)}</Text>
        )}
      </View>

      {bill.deliveryFee > 0 && (
        <Text style={styles.hint}>
          Add items worth {formatRupees(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery
        </Text>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Platform fee</Text>
        <Text style={styles.value}>{formatRupees(bill.platformFee)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>GST &amp; restaurant charges</Text>
        <Text style={styles.value}>{formatRupees(bill.taxes)}</Text>
      </View>

      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>To pay</Text>
        <Text style={styles.totalValue}>{formatRupees(bill.total)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadowCard,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  label: { fontSize: 13, color: colors.ink2 },
  value: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  struck: { color: colors.muted, textDecorationLine: 'line-through', fontWeight: '400' },
  free: { color: colors.free, fontWeight: '800' },
  hint: { fontSize: 11, color: colors.accentDark, paddingVertical: 2 },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8, paddingTop: 10 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: colors.ink },
  totalValue: { fontSize: 14, fontWeight: '800', color: colors.ink },
})
