import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { OUTLET } from '../data/menu'
import { colors, radius } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Normal order confirmation — identical for a coded order and an ordinary one (Epic 8.3).
export function OrderPlacedScreen() {
  const nav = useNavigation<Nav>()
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.check}><Text style={styles.checkMark}>✓</Text></View>
        <Text style={styles.title}>Order placed!</Text>
        <Text style={styles.muted}>Thanks for ordering from {OUTLET.name}.</Text>
        <Text style={styles.eta}>Estimated arrival {OUTLET.eta}</Text>
      </View>
      <View style={styles.bottomBar}>
        <Pressable style={styles.btn} onPress={() => nav.reset({ index: 0, routes: [{ name: 'Home' }] })}>
          <Text style={styles.btnText}>Back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: 16 },
  hero: { alignItems: 'center', marginTop: 60 },
  check: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.veg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  checkMark: { color: '#fff', fontSize: 34, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, marginTop: 4 },
  eta: { color: colors.ink, marginTop: 12, fontWeight: '600' },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  btn: { backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
})
