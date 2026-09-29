import { useEffect, useRef, useState, type RefObject } from 'react'

type Line = { kind: string; x1: number; y1: number; x2: number; y2: number; len: number; fresh: boolean }
type Beam = Line & { id: number }

const lengthOf = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1)

// SVG overlay under the tiles: every tile is linked to the case hub by a light line. When a new fact lands, its line
// draws itself on and a light pulse travels from the conversation panel (the board's right edge) into the new tile —
// the AI "carrying" the fact out of the call onto the board. Positions come from the live DOM (refs), re-measured
// whenever the board, hub or any tile resizes.
export default function LightLinks({
  containerRef,
  hubRef,
  tileEls,
  kinds,
  accentKind,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  hubRef: RefObject<HTMLDivElement | null>
  tileEls: RefObject<Map<string, HTMLElement>>
  kinds: string[]
  accentKind?: string
}) {
  const [lines, setLines] = useState<Line[]>([])
  const [beams, setBeams] = useState<Beam[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const seen = useRef<Set<string> | null>(null)
  const drawingUntil = useRef(new Map<string, number>())
  const beamId = useRef(0)
  const key = kinds.join('|')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const timers: ReturnType<typeof setTimeout>[] = []

    const measure = () => {
      const c = container.getBoundingClientRect()
      const hub = hubRef.current?.getBoundingClientRect()
      const hx = hub ? hub.left + hub.width / 2 - c.left : c.width / 2
      const hy = hub ? hub.top + hub.height / 2 - c.top : c.height / 2
      const first = seen.current === null
      const known = seen.current ?? new Set<string>()
      const next: Line[] = []
      const newBeams: Beam[] = []
      for (const kind of kinds) {
        const el = tileEls.current?.get(kind)
        if (!el) continue
        const r = el.getBoundingClientRect()
        const x1 = r.left + r.width / 2 - c.left
        const y1 = r.top + r.height / 2 - c.top
        const isNew = !first && !known.has(kind)
        if (isNew) drawingUntil.current.set(kind, Date.now() + 1000)
        const fresh = (drawingUntil.current.get(kind) ?? 0) > Date.now()
        next.push({ kind, x1, y1, x2: hx, y2: hy, len: lengthOf(x1, y1, hx, hy), fresh })
        if (isNew) {
          beamId.current += 1
          newBeams.push({ id: beamId.current, kind, x1: c.width, y1, x2: x1, y2: y1, len: lengthOf(c.width, y1, x1, y1), fresh: true })
        }
        known.add(kind)
      }
      seen.current = known
      setSize({ w: c.width, h: c.height })
      setLines(next)
      if (newBeams.length) {
        setBeams((b) => [...b, ...newBeams])
        const ids = new Set(newBeams.map((b) => b.id))
        timers.push(setTimeout(() => setBeams((b) => b.filter((x) => !ids.has(x.id))), 1600))
      }
    }

    const ro = new ResizeObserver(measure)
    ro.observe(container)
    if (hubRef.current) ro.observe(hubRef.current)
    tileEls.current?.forEach((el) => ro.observe(el))
    // Tiles spring in with a small transform; re-measure once they've settled so line ends land on the tile centres.
    timers.push(setTimeout(measure, 500))
    return () => {
      ro.disconnect()
      timers.forEach(clearTimeout)
    }
    // `key` stands in for `kinds`: re-subscribe only when the set of rendered tiles changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, containerRef, hubRef, tileEls])

  if (!size.w) return null
  return (
    <svg className="light-links" width={size.w} height={size.h} aria-hidden="true">
      {lines.map((l) => (
        <line
          key={l.kind}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          className={`link${l.kind === accentKind ? ' link-accent' : ''}${l.fresh ? ' link-draw' : ''}`}
          style={{ ['--len' as string]: `${l.len}px` }}
        />
      ))}
      {beams.map((b) => (
        <line
          key={b.id}
          x1={b.x1}
          y1={b.y1}
          x2={b.x2}
          y2={b.y2}
          className="beam"
          style={{ ['--len' as string]: `${b.len}px` }}
        />
      ))}
    </svg>
  )
}
