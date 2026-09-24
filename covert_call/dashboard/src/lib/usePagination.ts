import { useSearchParams } from 'react-router-dom'

export const PAGE_SIZE = 10

// Page number lives in the URL alongside filters; clamps when the list shrinks under a live update.
export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [params, setParams] = useSearchParams()
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pageCount)
  const start = (page - 1) * pageSize

  const setPage = (next: number) => {
    const p = new URLSearchParams(params)
    if (next <= 1) p.delete('page')
    else p.set('page', String(next))
    setParams(p)
  }

  return {
    page,
    pageCount,
    setPage,
    offset: start,
    pageItems: items.slice(start, start + pageSize),
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
  }
}
