type Props = { page: number; pageCount: number; from: number; to: number; total: number; noun: string; onPage: (p: number) => void }

function pageList(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const pages = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…' as const, p] : [p]))
}

export default function Pagination({ page, pageCount, from, to, total, noun, onPage }: Props) {
  return (
    <div className="pagination">
      <span className="muted-inline">
        {total ? `Showing ${from}–${to} of ${total} ${noun}` : `0 ${noun}`}
      </span>
      {pageCount > 1 && (
        <nav className="pager" aria-label="Pagination">
          <button type="button" className="btn btn-sm" disabled={page === 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
          {pageList(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="pager-gap">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`btn btn-sm${p === page ? ' btn-current' : ''}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className="btn btn-sm" disabled={page === pageCount} onClick={() => onPage(page + 1)}>Next ›</button>
        </nav>
      )}
    </div>
  )
}
