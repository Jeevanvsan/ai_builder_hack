import { useEffect, useMemo, useRef, useState } from 'react'
import { CODE_BY_ID } from '../../../../shared/codes'
import { coverPack, coverPhrases } from '../../../../shared/covers/index.ts'
import type { Incident } from '../../../../shared/incidents/types'

type Line = NonNullable<Incident['transcriptLines']>[number]
type Code = (typeof CODE_BY_ID)[string]
type Segment = { plain: string; code?: Code }
type Phrase = { re: RegExp; code: Code }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The call's own code phrases (QuickOne, Epic 33: the food, grocery, pharmacy, home or "other" words, picked by
// incident.cover; food when missing), each mapped to its real meaning. Whole words only, so a short phrase
// ("basic") never matches inside another word ("basically").
function phrasesFor(cover: Incident['cover']): Phrase[] {
  return coverPhrases(coverPack(cover)).map((p) => ({ re: new RegExp(`\\b${escape(p.phrase)}\\b`, 'i'), code: CODE_BY_ID[p.id] }))
}

// Coded phrases are shown with their real meaning inline, so the disguise decodes itself on screen as the caller
// speaks. The earliest match is taken first, so every option in Mia's "A, B or C?" question gets its meaning.
function annotate(text: string, phrases: Phrase[]): Segment[] {
  let best: { index: number; length: number; code: Code } | null = null
  for (const p of phrases) {
    const m = p.re.exec(text)
    if (m && (!best || m.index < best.index || (m.index === best.index && m[0].length > best.length))) {
      best = { index: m.index, length: m[0].length, code: p.code }
    }
  }
  if (!best) return text ? [{ plain: text }] : []
  const parts: Segment[] = []
  if (best.index > 0) parts.push({ plain: text.slice(0, best.index) })
  parts.push({ plain: text.slice(best.index, best.index + best.length), code: best.code })
  const after = text.slice(best.index + best.length)
  if (after) parts.push(...annotate(after, phrases))
  return parts
}

function Bubble({ line, isNew, phrases }: { line: Line; isNew: boolean; phrases: Phrase[] }) {
  const [shown, setShown] = useState(isNew ? 0 : line.text.length)

  useEffect(() => {
    if (!isNew || shown >= line.text.length) return
    const timer = setTimeout(() => setShown((s) => Math.min(s + 2, line.text.length)), 18)
    return () => clearTimeout(timer)
  }, [isNew, shown, line.text.length])

  const mia = line.speaker === 'Mia'
  // Only the newest line types itself out. Once a newer line arrives, show this one in full: the typing state
  // would otherwise freeze wherever it was ("The ride" for "The rider should bring it in").
  const visible = isNew ? shown : line.text.length
  return (
    <li className={`bubble ${mia ? 'bubble-mia' : 'bubble-caller'}`}>
      <span className="bubble-who">{mia ? 'Mia (AI)' : 'Caller'}</span>
      <span className="bubble-text">
        {annotate(line.text.slice(0, visible), phrases).map((p, i) =>
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

export default function Conversation({ lines, emptyText, cover }: { lines: Line[]; emptyText: string; cover?: Incident['cover'] }) {
  const listRef = useRef<HTMLUListElement>(null)
  const newestAt = lines.at(-1)?.at
  const phrases = useMemo(() => phrasesFor(cover), [cover])

  // The panel body is the scroller; keep the newest message in view as the call goes on.
  useEffect(() => {
    const scroller = listRef.current?.parentElement
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [lines.length])

  if (!lines.length) return <p className="panel-empty">{emptyText}</p>
  // A growing line is written several times as it streams in ("That's g", then "That's good…"); show only the
  // newest version of each.
  const merged = lines.reduce<Line[]>((acc, l) => {
    const prev = acc.at(-1)
    if (prev && prev.speaker === l.speaker && l.text.startsWith(prev.text)) acc[acc.length - 1] = l
    else if (!(prev && prev.speaker === l.speaker && prev.text.startsWith(l.text))) acc.push(l)
    return acc
  }, [])
  return (
    <ul className="bubbles" ref={listRef}>
      {merged.map((line, i) => <Bubble key={`${i}`} line={line} isNew={line.at === newestAt} phrases={phrases} />)}
    </ul>
  )
}
