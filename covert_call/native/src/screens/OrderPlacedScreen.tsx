import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { doc, onSnapshot } from 'firebase/firestore'
import type { RootStackParamList } from '../../App'
import { OUTLET } from '../data/menu'
import { db } from '../lib/firebase'
import { INCIDENTS } from '../../../shared/incidents/client'
import type { ResponseStatus } from '../../../shared/incidents/types'
import { CheckIcon } from '../components/disguise/icons'
import { colors, radius, shadowBar, shadowCard } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Native port of web/src/pages/OrderPlacedPage.tsx.
//
// The confirmation shown after "Place order" (Epic 8, Story 8.3). Deliberately an ordinary order-tracking screen:
// a coded order and a real order end here identically, so nothing reveals which one just happened.
//
// When it arrived from a coded order, it also mirrors the responder's progress on the incident as ordinary
// delivery status (Epic 8.3): acknowledged -> "Rider assigned", in progress -> "On the way", resolved -> delivered.
export function OrderPlacedScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'OrderPlaced'>>()
  const incidentId = route.params?.incidentId ?? null

  const [orderId] = useState(() => `QB${100000 + (Date.now() % 900000)}`)
  const [status, setStatus] = useState<ResponseStatus | null>(null)

  useEffect(() => {
    if (!incidentId) return
    // Read-only subscription (rules allow public read); shows nothing safety-related, only "delivery" progress.
    return onSnapshot(doc(db, INCIDENTS, incidentId), (snap) => {
      const s = snap.data()?.response?.status as ResponseStatus | undefined
      if (s) setStatus(s)
    })
  }, [incidentId])

  // Map the responder's real status onto believable delivery milestones.
  const stage = status === 'resolved' ? 3 : status === 'in_progress' ? 2 : status === 'acknowledged' ? 1 : 0
  const steps = ['Order confirmed', 'Rider assigned', 'On the way', 'Delivered']

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.check}>
            <CheckIcon size={30} />
          </View>
          <Text style={styles.heroTitle}>Order placed!</Text>
          <Text style={styles.heroSub}>Thanks for ordering from {OUTLET.name}.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>Order ID</Text>
              <Text style={styles.metaValue}>{orderId}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>Estimated arrival</Text>
              <Text style={styles.metaValue}>{OUTLET.eta}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order status</Text>
          {steps.map((label, idx) => {
            const done = idx <= stage
            return (
              <View key={label} style={styles.step}>
                <View style={[styles.stepDot, done && styles.stepDotDone]}>
                  {done && <Text style={styles.stepTick}>✓</Text>}
                </View>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{label}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <View style={styles.bar}>
        <Pressable
          style={styles.checkoutBar}
          onPress={() => nav.reset({ index: 0, routes: [{ name: 'Home' }] })}
        >
          <Text style={styles.checkoutCta}>Back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  hero: { alignItems: 'center', paddingTop: 36, paddingBottom: 8, gap: 6 },
  check: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.veg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroTitle: { fontSize: 21, fontWeight: '800', color: colors.ink },
  heroSub: { fontSize: 13, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadowCard,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 11, color: colors.muted },
  metaValue: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 3 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.veg, borderColor: colors.veg },
  stepTick: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepLabel: { fontSize: 13, color: colors.muted },
  stepLabelDone: { color: colors.ink, fontWeight: '700' },
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    ...shadowBar,
  },
  checkoutBar: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  checkoutCta: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
