import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+'
const FRAMES = 14
const FRAME_MS = 26

function scramble(text: string, from: number): string {
  let out = text.slice(0, from)
  for (let i = from; i < text.length; i++) {
    out += text[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
  }
  return out
}

// A value arriving from the AI decodes into place: characters scramble, then resolve left to right (~350ms).
// Re-runs only when the text changes; every run always finishes on the real text (safe under StrictMode).
export default function DecodeText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(text)

  useEffect(() => {
    if (reduced) return
    let frame = 0
    const id = setInterval(() => {
      frame += 1
      if (frame >= FRAMES) {
        clearInterval(id)
        setShown(text)
      } else {
        setShown(scramble(text, Math.floor((text.length * frame) / FRAMES)))
      }
    }, FRAME_MS)
    return () => {
      clearInterval(id)
      setShown(text)
    }
  }, [text, reduced])

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{reduced ? text : shown}</span>
    </span>
  )
}
