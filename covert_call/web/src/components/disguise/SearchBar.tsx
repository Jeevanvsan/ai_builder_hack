import { CloseIcon, SearchIcon } from './icons'

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="search">
      <SearchIcon size={18} className="search-icon" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for dishes"
        aria-label="Search for dishes"
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
