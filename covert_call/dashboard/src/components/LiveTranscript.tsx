import { useEffect, useState } from 'react'
import { ALL_CODES } from '../../../shared/codes'
import type { Incident } from '../../../shared/incidents/types'

type Line = NonNullable<Incident['transcriptLines']>[number]

// Epic 17.2: highlights a coded phrase inline with its real meaning, e.g. "extra pepperoni" struck through with
// "→ weapon present" beside it — the same code table the persona and the coded menu both use (shared/codes.ts),
// so the call and the annotation can never drift apart. Only Round 1 codes are in this shared table today; the
// deeper Round 2+ drill-down phrases (clothing, vehicle colour, etc.) live only in persona.ts's prompt text and
// aren't matched here yet.
type Code = (typeof ALL_CODES)[number]
type Segment = { plain: string; code?: Code }

function annotate(text: string): Segment[] {
  const lower = text.toLowerCase()
  const hit = ALL_CODES.find((c) => lower.includes(c.food))
  if (!hit) return text ? [{ plain: text }] : []
  const idx = lower.indexOf(hit.food)
  const before = text.slice(0, idx)
  const matched = text.slice(idx, idx + hit.food.length)
  const after = text.slice(idx + hit.food.length)
  const parts: Segment[] = []
  if (before) parts.push({ plain: before })
  parts.push({ plain: matched, code: hit })
  if (after) parts.push(...annotate(after))
  return parts
}

// Epic 17.2 (typewriter reveal, Epic 38 in the brainstorm doc): each new line streams in character by character
// rather than appearing all at once, so a coded phrase's annotation lands right as the phrase finishes appearing.
function TypedLine({ line, isNew }: { line: Line; isNew: boolean }) {
  const [shown, setShown] = useState(isNew ? 0 : line.text.length)

  useEffect(() => {
    if (!isNew) return
    if (shown >= line.text.length) return
    const timer = setTimeout(() => setShown((s) => Math.min(s + 2, line.text.length)), 18)
    return () => clearTimeout(timer)
  }, [isNew, shown, line.text.length])

  const visible = line.text.slice(0, shown)
  const parts = annotate(visible)

  return (
    <li className={`transcript-line transcript-${line.speaker === 'Mia' ? 'mia' : 'caller'}`}>
      <span className="transcript-speaker">{line.speaker}</span>
      <span className="transcript-text">
        {parts.map((p, i) =>
          p.code ? (
            <span key={i} className="transcript-coded" title={`Really means: ${p.code.meaning}`}>
              <s>{p.plain}</s>
              <span className="transcript-meaning">→ {p.code.indicator}</span>
            </span>
          ) : (
            <span key={i}>{p.plain}</span>
          ),
        )}
      </span>
    </li>
  )
}

export default function LiveTranscript({ lines }: { lines: Line[] }) {
  if (!lines.length) return null
  // Only the most-recently-arrived line gets the typewriter treatment — older lines (already seen) render in full
  // immediately, so scrolling back through history doesn't replay the animation.
  const newestAt = lines.at(-1)?.at
  return (
    <div className="card transcript-card">
      <h2>Live transcript</h2>
      <p className="sub">Coded phrases are shown with their real meaning as they're spoken.</p>
      <ul className="transcript-lines">
        {lines.map((line, i) => (
          <TypedLine key={`${line.at}-${i}`} line={line} isNew={line.at === newestAt} />
        ))}
      </ul>
    </div>
  )
}
