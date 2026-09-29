import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../../App'
import { colors } from '../../theme'
import { ChevronLeftIcon } from './icons'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/components/disguise/PageHeader.tsx. `backTo` names a route rather than a URL; the
// screens that use it are always reached from Home or Cart, so a plain navigate is the same journey the web
// takes with its back button.
export function PageHeader({
  title,
  subtitle,
  backTo,
}: {
  title: string
  subtitle?: string
  backTo: keyof RootStackParamList
}) {
  const nav = useNavigation<Nav>()
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.back}
        hitSlop={8}
        onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate(backTo as never))}
      >
        <ChevronLeftIcon size={24} />
      </Pressable>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11, color: colors.muted, marginTop: 1 },
})
