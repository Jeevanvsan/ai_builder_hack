import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { CATEGORIES, type CategoryId } from '../../data/menu'
import { colors } from '../../theme'

export type CategoryFilter = CategoryId | 'all'

// Native port of web/src/components/disguise/CategoryChips.tsx.
export function CategoryChips({ value, onChange }: { value: CategoryFilter; onChange: (c: CategoryFilter) => void }) {
  const chips: { id: CategoryFilter; label: string }[] = [{ id: 'all', label: 'All' }, ...CATEGORIES]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((c) => {
        const active = value === c.id
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.ink2, fontWeight: '600' },
  chipTextActive: { color: colors.accentDark },
})
