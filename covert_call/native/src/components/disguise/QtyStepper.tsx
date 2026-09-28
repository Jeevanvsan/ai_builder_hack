import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '../../theme'

// Native port of web/src/components/disguise/QtyStepper.tsx.
export function QtyStepper({
  qty,
  onInc,
  onDec,
  size = 'md',
}: {
  qty: number
  onInc: () => void
  onDec: () => void
  size?: 'sm' | 'md'
}) {
  const sm = size === 'sm'
  return (
    <View style={[styles.wrap, sm && styles.wrapSm]}>
      <Pressable onPress={onDec} hitSlop={6} style={styles.btn}>
        <Text style={[styles.sign, sm && styles.signSm]}>−</Text>
      </Pressable>
      <Text style={[styles.qty, sm && styles.qtySm]}>{qty}</Text>
      <Pressable onPress={onInc} hitSlop={6} style={styles.btn}>
        <Text style={[styles.sign, sm && styles.signSm]}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    height: 34,
    minWidth: 92,
  },
  wrapSm: { height: 28, minWidth: 76, paddingHorizontal: 6 },
  btn: { paddingHorizontal: 4 },
  sign: { fontSize: 17, fontWeight: '700', color: colors.accentDark, lineHeight: 20 },
  signSm: { fontSize: 15, lineHeight: 18 },
  qty: { fontSize: 14, fontWeight: '800', color: colors.accentDark, minWidth: 20, textAlign: 'center' },
  qtySm: { fontSize: 13 },
})
