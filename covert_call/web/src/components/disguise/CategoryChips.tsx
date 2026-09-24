import { CATEGORIES, type CategoryId } from '../../data/menu'

export type CategoryFilter = CategoryId | 'all'

export function CategoryChips({ value, onChange }: { value: CategoryFilter; onChange: (c: CategoryFilter) => void }) {
  const chips: { id: CategoryFilter; label: string }[] = [{ id: 'all', label: 'All' }, ...CATEGORIES]
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
