// Shared ECharts styling so every chart on the analytics pages reads as one coherent system rather than a
// grab-bag of defaults. Colors are read from the page's CSS custom properties so charts stay in sync with the
// light theme (docs/quickbite_plan.md "Visual theme: light, not dark").

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#000'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const chartColors = {
  accent: () => cssVar('--accent'),
  high: () => cssVar('--high'),
  medium: () => cssVar('--medium'),
  low: () => cssVar('--low'),
  live: () => cssVar('--live'),
  muted: () => cssVar('--muted'),
  border: () => cssVar('--border'),
  text: () => cssVar('--text'),
}

export const severityColor: Record<'high' | 'medium' | 'low', string> = {
  get high() { return chartColors.high() },
  get medium() { return chartColors.medium() },
  get low() { return chartColors.low() },
}

export const baseGrid = { left: 8, right: 16, top: 24, bottom: 8, containLabel: true }

export const baseTooltip = {
  trigger: 'axis' as const,
  backgroundColor: '#fff',
  borderColor: chartColors.border(),
  textStyle: { color: chartColors.text() },
}

export const baseAxisLabel = { color: chartColors.muted(), fontSize: 11 }
export const baseAxisLine = { lineStyle: { color: chartColors.border() } }
export const baseSplitLine = { lineStyle: { color: chartColors.border(), type: 'dashed' as const } }

// A soft top-to-bottom gradient fill, the signature ECharts look for area/bar emphasis.
export function gradientFill(colorHex: string) {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: colorHex },
      { offset: 1, color: `${colorHex}22` },
    ],
  }
}
