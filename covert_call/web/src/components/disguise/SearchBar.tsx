import { CloseIcon, SearchIcon } from './icons'

export function SearchBar({ value, onChange, placeholder = 'Search for dishes' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="search">
      <SearchIcon size={18} className="search-icon" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <CloseIcon size={16} />
        </button>
      )}
    </label>
  )
}
