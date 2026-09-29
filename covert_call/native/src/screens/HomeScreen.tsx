import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CATEGORIES, MENU, type MenuItem } from '../data/menu'
import { BottomBar } from '../components/disguise/BottomBar'
import { CategoryChips, type CategoryFilter } from '../components/disguise/CategoryChips'
import { ItemSheet } from '../components/disguise/ItemSheet'
import { MenuItemCard } from '../components/disguise/MenuItemCard'
import { PromoBanner } from '../components/disguise/PromoBanner'
import { SearchBar } from '../components/disguise/SearchBar'
import { TopBar } from '../components/disguise/TopBar'
import { colors } from '../theme'

// Native port of web/src/pages/HomePage.tsx.
export function HomeScreen() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      MENU.filter(
        (m) =>
          (category === 'all' || m.category === category) &&
          (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)),
      ),
    [category, q],
  )

  const sections = CATEGORIES.map((c) => ({ ...c, items: filtered.filter((m) => m.category === c.id) })).filter(
    (s) => s.items.length > 0,
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Index 1 is the search + chips block, so it pins to the top once the header scrolls away. */}
      <ScrollView stickyHeaderIndices={[1]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar />

        <View style={styles.tools}>
          <SearchBar value={query} onChange={setQuery} />
          <View style={styles.chips}>
            <CategoryChips value={category} onChange={setCategory} />
          </View>
        </View>

        {/* The promo is the default-state decoration only — searching or filtering hides it, as on the web. */}
        {!q && category === 'all' && <PromoBanner />}

        <View style={styles.menu}>
          {sections.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No dishes match “{query.trim()}”</Text>
              <Text style={styles.emptySub}>Try searching for pizza, biryani or burger.</Text>
            </View>
          )}

          {sections.map((s) => (
            <View key={s.id} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {s.label} <Text style={styles.sectionCount}>({s.items.length})</Text>
              </Text>
              {s.items.map((item) => (
                <MenuItemCard key={item.id} item={item} onOpen={setOpenItem} />
              ))}
            </View>
          ))}

          <Text style={styles.footnote}>Prices inclusive of packaging. Images are for representation only.</Text>
        </View>
      </ScrollView>

      <BottomBar />
      {openItem && <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  tools: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 },
  chips: { marginHorizontal: -16, paddingLeft: 16 },
  menu: { paddingHorizontal: 16, paddingTop: 8 },
  section: { paddingTop: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  sectionCount: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptySub: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  footnote: { fontSize: 11, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
})
