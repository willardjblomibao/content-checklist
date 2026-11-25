import { ReactNode, useId } from 'react'

/**
 * Shared look for every Recharts chart in the app.
 *
 * Categorical slots are validated together (lightness band, chroma floor,
 * colour-blind separation and normal-vision separation all pass on a white
 * surface). Assign them in this fixed order and never cycle past the end —
 * a 7th series folds into "Other". Slots 2 and 4 sit under 3:1 contrast on
 * white, so every chart keeps its legend/tooltip and the page keeps a table.
 */
export const SERIES = ['#0E9C83', '#F2703F', '#6A4CE2', '#D99A0B', '#E35D8E', '#2F7FD8'] as const

/** De-emphasis colour for a comparison series (e.g. last year next to this year). */
export const MUTED = '#C9CCC4'

export const INK = {
  primary: '#1C1E1C',
  secondary: '#727872',
  faint: '#95998F',
  grid: '#ECEEE9',
}

// ---------- number formatting ----------

/** 0 / 950 / 1,284 / 12.9K / 4.2M — one style per axis. */
export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (abs >= 10_000) return `${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return n.toLocaleString()
}

export function full(n: number | string): string {
  return typeof n === 'number' ? n.toLocaleString() : n
}

// ---------- axis / grid presets (spread onto Recharts elements) ----------

const tick = { fontSize: 11, fill: INK.secondary, fontFamily: 'Inter, system-ui, sans-serif' }

export const xAxisProps = {
  axisLine: { stroke: INK.grid },
  tickLine: false,
  tick,
  tickMargin: 10,
  minTickGap: 12,
} as const

/** Round a step up to 1 / 2 / 2.5 / 5 × 10ⁿ. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * pow
}

/**
 * Clean y-axis for a data maximum: 4 or 5 even steps of 1 / 2 / 2.5 / 5 × 10ⁿ,
 * whichever puts the top closest to the data (e.g. 243K → 0…250K by 50K).
 * Spread onto <YAxis>: `{...niceY(max)}`.
 */
export function niceY(dataMax: number, { integer = false }: { integer?: boolean } = {}) {
  const max = Number.isFinite(dataMax) && dataMax > 0 ? dataMax : 4
  let best: { step: number; count: number } | null = null
  for (const count of [4, 5]) {
    let step = niceStep(max / count)
    if (integer) step = Math.max(1, Math.ceil(step))
    const n = Math.ceil(max / step)
    const top = step * n
    if (n <= 5 && (!best || top < best.step * best.count)) best = { step, count: n }
  }
  const { step, count } = best!
  const ticks = Array.from({ length: count + 1 }, (_, i) => +(i * step).toFixed(6))
  return { domain: [0, ticks[ticks.length - 1]] as [number, number], ticks }
}

/** Largest value across the given keys of a dataset. */
export function maxOf<T extends Record<string, unknown>>(rows: T[], keys: string[]): number {
  let m = 0
  for (const r of rows) for (const k of keys) m = Math.max(m, Number(r[k]) || 0)
  return m
}

export const yAxisProps = {
  axisLine: false,
  tickLine: false,
  tick,
  tickMargin: 6,
  width: 52,
  tickFormatter: (v: number) => compact(v),
} as const

/** Single-line category tick (Recharts wraps long labels by default). */
export function CategoryTick(props: { x?: number; y?: number; payload?: { value: string }; maxChars?: number }) {
  const { x = 0, y = 0, payload, maxChars = 16 } = props
  const v = String(payload?.value ?? '')
  const label = v.length > maxChars ? `${v.slice(0, maxChars - 1)}…` : v
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fontWeight={500} fill={INK.primary} fontFamily="Inter, system-ui, sans-serif">
      <title>{v}</title>
      {label}
    </text>
  )
}

export const gridProps = {
  vertical: false,
  stroke: INK.grid,
  strokeDasharray: '0',
} as const

export const chartMargin = { top: 8, right: 12, bottom: 0, left: 0 }

/** Soft highlight column behind the hovered category. */
export const barCursor = { fill: 'rgba(14, 156, 131, 0.06)', radius: 8 } as const

/** Vertical guide line for line/area charts. */
export const lineCursor = { stroke: INK.faint, strokeWidth: 1, strokeDasharray: '3 4' } as const

/** Bar shape: 4px rounded data end, square at the baseline, capped width. */
export const barProps = {
  radius: [5, 5, 0, 0] as [number, number, number, number],
  maxBarSize: 28,
}

export const lineProps = {
  type: 'monotone' as const,
  strokeWidth: 2.25,
  dot: false,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Hover marker: 10px dot with a 2px white ring. */
export function activeDot(color: string) {
  return { r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }
}

// ---------- gradients ----------

/** Unique, stable gradient ids for one chart instance. */
export function useGradientIds(keys: readonly string[]) {
  const base = useId().replace(/:/g, '')
  return Object.fromEntries(keys.map((k) => [k, `${base}-${k.replace(/[^a-z0-9]/gi, '')}`])) as Record<string, string>
}

/** Top-lit bar fill: the full colour fading slightly toward the baseline. */
export function BarGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.62} />
    </linearGradient>
  )
}

/** Area wash under a line: ~20% at the line, fading to nothing. */
export function AreaGradient({ id, color, strength = 0.2 }: { id: string; color: string; strength?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={strength} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

/** Soft glow filter for lines. */
export function GlowFilter({ id, color }: { id: string; color: string }) {
  return (
    <filter id={id} x="-10%" y="-30%" width="120%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={color} floodOpacity="0.28" />
    </filter>
  )
}

// ---------- tooltip ----------

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
  fill?: string
  stroke?: string
}

/**
 * Dark frosted tooltip. Pass as `content={<ChartTooltip />}`.
 * Recharts injects `active`, `label` and `payload`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = full,
  colorFor,
  footer,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  labelFormatter?: (label: string | number) => ReactNode
  valueFormatter?: (v: number | string, entry: TooltipEntry) => ReactNode
  /** Override swatch colour (e.g. per-bar Cell colours). */
  colorFor?: (entry: TooltipEntry) => string | undefined
  footer?: (payload: TooltipEntry[]) => ReactNode
}) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload.filter((p) => p.value !== undefined && p.value !== null)
  return (
    <div className="rounded-xl bg-ink-950/90 backdrop-blur-md px-3.5 py-2.5 shadow-softLg ring-1 ring-white/10 min-w-[150px]">
      {label !== undefined && label !== '' && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-300 mb-1.5">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {rows.map((p, i) => {
          const color = colorFor?.(p) ?? (p.payload?.color as string | undefined) ?? p.color ?? p.stroke ?? p.fill
          return (
            <div key={`${p.dataKey}-${i}`} className="flex items-center gap-2.5 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: color }} />
              <span className="text-ink-200 flex-1 truncate">{p.name}</span>
              <span className="font-semibold text-white tabular-nums">{valueFormatter(p.value as number, p)}</span>
            </div>
          )
        })}
      </div>
      {footer && <div className="mt-2 pt-2 border-t border-white/10 text-xs text-ink-300">{footer(rows)}</div>}
    </div>
  )
}

// ---------- legend ----------

/** Legend as a row of swatch + label pills; text stays in ink, never the series colour. */
export function ChartLegend({ items, className = '' }: { items: { label: string; color: string; muted?: boolean }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

// ---------- card ----------

/**
 * Standard chart card: title, optional subtitle, legend/controls on the right,
 * and a fixed-height plot area.
 */
export function ChartCard({
  title,
  subtitle,
  aside,
  height = 288,
  children,
  className = '',
  footer,
}: {
  title: ReactNode
  subtitle?: ReactNode
  aside?: ReactNode
  height?: number
  children: ReactNode
  className?: string
  footer?: ReactNode
}) {
  return (
    <div className={`bg-white border border-ink-100 rounded-2xl shadow-card p-5 flex flex-col min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
        {aside && <div className="flex items-center gap-3 flex-wrap">{aside}</div>}
      </div>
      <div style={{ height }} className="min-w-0">
        {children}
      </div>
      {footer}
    </div>
  )
}
