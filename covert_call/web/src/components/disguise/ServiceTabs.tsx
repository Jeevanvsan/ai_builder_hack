import type { ComponentType } from 'react'
import { SERVICE_IDS, SERVICES, type ServiceId } from '../../data/services'
import { BasketIcon, BowlIcon, HomeIcon, PillIcon } from './icons'

const ICONS: Record<ServiceId, ComponentType<{ size?: number }>> = { food: BowlIcon, grocery: BasketIcon, pharmacy: PillIcon, home: HomeIcon }

// QuickOne's services (Epic 33): an ordinary super-app tab row. Each tab is also the cover its "Call" button
// starts Mia in, so the caller picks whichever errand sounds normal right now.
export function ServiceTabs({ value, onChange }: { value: ServiceId; onChange: (id: ServiceId) => void }) {
  return (
    <nav className="service-tabs" aria-label="Services">
      {SERVICE_IDS.map((id) => {
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            type="button"
            className={`service-tab ${value === id ? 'is-active' : ''}`}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            <Icon size={22} />
            <span>{SERVICES[id].label}</span>
          </button>
        )
      })}
    </nav>
  )
}
