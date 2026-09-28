import { useEffect, useRef } from 'react'
import DecodeText from './DecodeText'

const TONE = (s: number) => (s >= 70 ? '#d92a3f' : s >= 45 ? '#c47600' : '#2b6cb0')

// Voice stress as a monitor trace drawn from the real stress samples, not a static bar. Redraws on new samples
// and on resize; the 70 line marks the "high" threshold deriveSeverity() uses.
export default function StressWave({ trend, score }: { trend: { timestamp: string; score: number }[]; score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const y = (v: number) => h - 4 - (v / 100) * (h - 8)
      ctx.strokeStyle = 'rgba(20,30,50,0.12)'
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(0, y(70))
      ctx.lineTo(w, y(70))
      ctx.stroke()
      ctx.setLineDash([])

      const pts = trend.length ? trend.map((t) => t.score) : [score]
      const step = pts.length > 1 ? w / (pts.length - 1) : 0
      const grad = ctx.createLinearGradient(0, 0, w, 0)
      grad.addColorStop(0, 'rgba(43,108,176,0.5)')
      grad.addColorStop(1, TONE(score))
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.shadowColor = TONE(score)
      ctx.shadowBlur = 8
      ctx.beginPath()
      pts.forEach((v, i) => (i === 0 ? ctx.moveTo(i * step, y(v)) : ctx.lineTo(i * step, y(v))))
      ctx.stroke()

      const lastX = (pts.length - 1) * step
      ctx.fillStyle = TONE(score)
      ctx.beginPath()
      ctx.arc(lastX || w / 2, y(pts[pts.length - 1]), 3, 0, Math.PI * 2)
      ctx.fill()
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [trend, score])

  return (
    <div className="stress-wave">
      <DecodeText text={String(score)} className="stress-wave-value" />
      <canvas ref={canvasRef} className="stress-wave-canvas" aria-label={`Voice stress trend, currently ${score} of 100`} />
    </div>
  )
}
