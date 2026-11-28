import type { CategoryId } from '../../data/menu'

export type CategoryFilter = CategoryId | 'all'

// The open service's categories (data/services.ts), after "All".
export function CategoryChips({ categories, value, onChange }: { categories: { id: CategoryId; label: string }[]; value: CategoryFilter; onChange: (c: CategoryFilter) => void }) {
  const chips: { id: CategoryFilter; label: string }[] = [{ id: 'all', label: 'All' }, ...categories]
  return (
    <nav className="chips" aria-label="Menu categories">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`chip ${value === c.id ? 'is-active' : ''}`}
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
        >
          {c.label}
        </button>
      ))}
    </nav>
  )
}
