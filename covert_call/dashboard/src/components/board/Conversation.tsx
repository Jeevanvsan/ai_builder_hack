import { useEffect, useRef, useState } from 'react'
import { ALL_CODES } from '../../../../shared/codes'
import type { Incident } from '../../../../shared/incidents/types'

type Line = NonNullable<Incident['transcriptLines']>[number]
type Code = (typeof ALL_CODES)[number]
type Segment = { plain: string; code?: Code }

// Coded phrases (shared/codes.ts — the same table the persona and the coded menu use) are shown with their real
// meaning inline, so the disguise decodes itself on screen as the caller speaks.
function annotate(text: string): Segment[] {
  const lower = text.toLowerCase()
  const hit = ALL_CODES.find((c) => lower.includes(c.food))
  if (!hit) return text ? [{ plain: text }] : []
  const idx = lower.indexOf(hit.food)
  const parts: Segment[] = []
  if (idx > 0) parts.push({ plain: text.slice(0, idx) })
  parts.push({ plain: text.slice(idx, idx + hit.food.length), code: hit })
  const after = text.slice(idx + hit.food.length)
  if (after) parts.push(...annotate(after))
  return parts
}

function Bubble({ line, isNew }: { line: Line; isNew: boolean }) {
  const [shown, setShown] = useState(isNew ? 0 : line.text.length)

  useEffect(() => {
    if (!isNew || shown >= line.text.length) return
    const timer = setTimeout(() => setShown((s) => Math.min(s + 2, line.text.length)), 18)
    return () => clearTimeout(timer)
  }, [isNew, shown, line.text.length])

  const mia = line.speaker === 'Mia'
  return (
    <li className={`bubble ${mia ? 'bubble-mia' : 'bubble-caller'}`}>
      <span className="bubble-who">{mia ? 'Mia (AI)' : 'Caller'}</span>
      <span className="bubble-text">
        {annotate(line.text.slice(0, shown)).map((p, i) =>
          p.code ? (
            <span key={i} className="bubble-coded" title={`Really means: ${p.code.meaning}`}>
              <s>{p.plain}</s>
              <span className="bubble-meaning">{p.code.indicator}</span>
            </span>
          ) : (
            <span key={i}>{p.plain}</span>
          ),
        )}
      </span>
    </li>
  )
}

export default function Conversation({ lines, emptyText }: { lines: Line[]; emptyText: string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const newestAt = lines.at(-1)?.at

  // The panel body is the scroller; keep the newest message in view as the call goes on.
  useEffect(() => {
    const scroller = listRef.current?.parentElement
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [lines.length])

  if (!lines.length) return <p className="panel-empty">{emptyText}</p>
  return (
    <ul className="bubbles" ref={listRef}>
      {lines.map((line, i) => <Bubble key={`${line.at}-${i}`} line={line} isNew={line.at === newestAt} />)}
    </ul>
  )
}
