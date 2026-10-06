import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Incident } from '../../../shared/incidents/types.ts'
// The responder dashboard's own Scene sketch, so the case report shows exactly the drawing a responder saw.
import SceneSketch from '../../../dashboard/src/components/board/SceneSketch'

// The dashboard's sketch styles (dashboard/src/index.css, "Live scene sketch"), with the drawing animations
// replaced by their final state: this is a still picture.
const STYLE = `
text { text-anchor: middle; stroke: none; }
.sk-hand { font: 700 13px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive; }
.sk-label { font: 800 10px 'Segoe UI', Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.sk-sub { font: 600 10px 'Segoe UI', Arial, sans-serif; fill: #5b6472; }
.sk-note { font: italic 600 10px 'Segoe UI', Arial, sans-serif; fill: #5b6472; }
.sk-q { font: 800 16px 'Segoe Print', cursive; fill: #9aa3af; }
.sk-plate { font: 800 9px Consolas, monospace; fill: #22262d; letter-spacing: .06em; }
.sk-red { fill: #d92a3f; } .sk-blue { fill: #1a73e8; }
.sk-stroke { stroke-width: 1.8; stroke-linejoin: round; }
.sk-draw { stroke-dasharray: none; stroke-dashoffset: 0; }
`
const SCALE = 3
const FACT_H = 34
const DOT: Record<string, string> = { danger: '#d92a3f', ok: '#2f9e44', route: '#1a73e8', unknown: '#9aa3af' }

// Base64 JPEG of the scene sketch plus its fact list, or null if there's nothing to draw yet.
export async function buildSceneSketchImage(id: string, incident: Omit<Incident, 'id'>): Promise<string | null> {
  const markup = renderToStaticMarkup(createElement(SceneSketch, { incident: { ...incident, id } as Incident }))
  const dom = new DOMParser().parseFromString(`<div>${markup}</div>`, 'text/html')
  const svg = dom.querySelector('svg')
  if (!svg) return null
  const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 360 230').split(/\s+/).map(Number)
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', String(vw * SCALE))
  svg.setAttribute('height', String(vh * SCALE))
  const style = dom.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = STYLE
  svg.insertBefore(style, svg.firstChild)
  const facts = [...dom.querySelectorAll('.sk-facts li')].map((li) => {
    const tag = li.querySelector('em')?.textContent ?? ''
    return { text: (li.textContent ?? '').slice(0, (li.textContent ?? '').length - tag.length).trim(), tag, kind: li.className }
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('sketch svg failed to load'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
  })

  const W = vw * SCALE
  const H = vh * SCALE + 50 + facts.length * FACT_H + 16
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, W, 46)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px Arial'
  ctx.fillText(`QuickBite case ${id}: scene sketch`, 16, 30)
  ctx.drawImage(img, 0, 46, W, vh * SCALE)

  let y = 46 + vh * SCALE + 12
  for (const f of facts) {
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(12, y, W - 24, FACT_H - 6)
    ctx.strokeStyle = '#e5e7eb'
    ctx.strokeRect(12, y, W - 24, FACT_H - 6)
    ctx.beginPath()
    ctx.arc(28, y + (FACT_H - 6) / 2, 5, 0, Math.PI * 2)
    ctx.fillStyle = DOT[f.kind] ?? '#6b7280'
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.font = '600 16px Arial'
    ctx.fillText(f.text.slice(0, 95), 44, y + 20)
    ctx.fillStyle = '#6b7280'
    ctx.font = 'bold 12px Arial'
    ctx.fillText(f.tag.toUpperCase(), W - 24 - ctx.measureText(f.tag.toUpperCase()).width, y + 19)
    y += FACT_H
  }
  return canvas.toDataURL('image/jpeg', 0.88).split(',')[1] ?? null
}
