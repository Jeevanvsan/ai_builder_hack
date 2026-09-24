import { useCallback, useMemo, useState } from 'react'
import { CATEGORIES, MENU, type MenuItem } from '../data/menu'
import { BottomBar } from '../components/disguise/BottomBar'
import { CategoryChips, type CategoryFilter } from '../components/disguise/CategoryChips'
import { ItemSheet } from '../components/disguise/ItemSheet'
import { MenuItemCard } from '../components/disguise/MenuItemCard'
import { PromoBanner } from '../components/disguise/PromoBanner'
import { SearchBar } from '../components/disguise/SearchBar'
import { TopBar } from '../components/disguise/TopBar'

export function HomePage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)
  const closeSheet = useCallback(() => setOpenItem(null), [])

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
    <div className="page page-home">
      <TopBar />
      <div className="sticky-tools">
        <SearchBar value={query} onChange={setQuery} />
        <CategoryChips value={category} onChange={setCategory} />
      </div>
      {!q && category === 'all' && <PromoBanner />}

      <main className="menu">
        {sections.length === 0 && (
          <div className="empty-results">
            <p>No dishes match “{query.trim()}”</p>
            <span>Try searching for pizza, biryani or burger.</span>
          </div>
        )}
        {sections.map((s) => (
          <section key={s.id} className="menu-section">
            <h2 className="menu-section-title">
              {s.label} <span>({s.items.length})</span>
            </h2>
            {s.items.map((item) => (
              <MenuItemCard key={item.id} item={item} onOpen={setOpenItem} />
            ))}
          </section>
        ))}
        <p className="menu-footnote">Prices inclusive of packaging. Images are for representation only.</p>
      </main>

      <BottomBar />
      {openItem && <ItemSheet item={openItem} onClose={closeSheet} />}
    </div>
  )
}
