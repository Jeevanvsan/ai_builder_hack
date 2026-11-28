import { useCallback, useMemo, useState } from 'react'
import { MENU, serviceOf, type MenuItem } from '../data/menu'
import { SERVICES, readService, saveService, type ServiceId } from '../data/services'
import { BottomBar } from '../components/disguise/BottomBar'
import { CategoryChips, type CategoryFilter } from '../components/disguise/CategoryChips'
import { ItemSheet } from '../components/disguise/ItemSheet'
import { MenuItemCard } from '../components/disguise/MenuItemCard'
import { PromoBanner } from '../components/disguise/PromoBanner'
import { SearchBar } from '../components/disguise/SearchBar'
import { ServiceTabs } from '../components/disguise/ServiceTabs'
import { TopBar } from '../components/disguise/TopBar'

export function HomePage() {
  // QuickOne (Epic 33): the open service tab, remembered for the session (back from the cart lands on the same tab).
  const [serviceId, setServiceId] = useState<ServiceId>(readService)
  const service = SERVICES[serviceId]
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)
  const closeSheet = useCallback(() => setOpenItem(null), [])
  const switchService = (id: ServiceId) => {
    setServiceId(id)
    saveService(id)
    setCategory('all')
    setQuery('')
  }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      MENU.filter(
        (m) =>
          serviceOf(m) === serviceId &&
          (category === 'all' || m.category === category) &&
          (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)),
      ),
    [serviceId, category, q],
  )

  const sections = service.categories.map((c) => ({ ...c, items: filtered.filter((m) => m.category === c.id) })).filter(
    (s) => s.items.length > 0,
  )

  return (
    <div className="page page-home">
      <TopBar />
      <ServiceTabs value={serviceId} onChange={switchService} />
      <div className="sticky-tools">
        <SearchBar value={query} onChange={setQuery} placeholder={service.search} />
        <CategoryChips categories={service.categories} value={category} onChange={setCategory} />
      </div>
      {!q && category === 'all' && <PromoBanner service={service} />}

      <main className="menu">
        {sections.length === 0 && (
          <div className="empty-results">
            <p>{service.noMatch} “{query.trim()}”</p>
            <span>{service.tryWords}</span>
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

      <BottomBar service={service} />
      {openItem && <ItemSheet item={openItem} onClose={closeSheet} />}
    </div>
  )
}
