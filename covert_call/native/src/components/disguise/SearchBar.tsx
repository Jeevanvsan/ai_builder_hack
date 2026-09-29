import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { colors, radius } from '../../theme'
import { CloseIcon, SearchIcon } from './icons'

// Native port of web/src/components/disguise/SearchBar.tsx.
export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.wrap}>
      <SearchIcon size={17} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Search for dishes"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <CloseIcon size={15} color={colors.muted} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  // A fixed height keeps the field from growing on Android, where TextInput has generous default padding.
  input: { flex: 1, height: 42, color: colors.ink, fontSize: 14, padding: 0 },
})
