import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from './icons'

export function PageHeader({ title, subtitle, backTo }: { title: string; subtitle?: string; backTo: string }) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      <button type="button" className="icon-btn" onClick={() => navigate(backTo)} aria-label="Back">
        <ChevronLeftIcon size={22} />
      </button>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
  )
}
