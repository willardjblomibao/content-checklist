import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Segmented } from '../ui/primitives'
import {
  SERIES,
  MUTED,
  INK,
  compact,
  xAxisProps,
  yAxisProps,
  gridProps,
  chartMargin,
  barCursor,
  lineCursor,
  barProps,
  lineProps,
  activeDot,
  useGradientIds,
  BarGradient,
  AreaGradient,
  GlowFilter,
  ChartTooltip,
  ChartLegend,
  ChartCard,
  CategoryTick,
  niceY,
  maxOf,
} from './chartKit'

// ------------------------------------------------------------------
// Weekly trend: one metric at a time (Views and New Audience differ by
// ~100x, so on one axis the audience line flattens to zero).
// ------------------------------------------------------------------

export function WeeklyTrendChart({
  data,
  title = 'Weekly trend',
  subtitle,
}: {
  data: { week: string; Views: number; 'New Audience': number }[]
  title?: string
  subtitle?: string
}) {
  const [metric, setMetric] = useState<'Views' | 'New Audience'>('Views')
  const color = metric === 'Views' ? SERIES[0] : SERIES[2]
  const ids = useGradientIds(['area', 'glow'])
  const total = data.reduce((s, d) => s + d[metric], 0)
  const last = data[data.length - 1]?.[metric] ?? 0

  return (
    <ChartCard
      title={title}
      subtitle={subtitle ?? `${compact(total)} ${metric.toLowerCase()} · latest week ${last.toLocaleString()}`}
      aside={
        <Segmented
          size="sm"
          ariaLabel="Metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'Views', label: 'Views' },
            { value: 'New Audience', label: 'New audience' },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            <AreaGradient id={ids.area} color={color} strength={0.24} />
            <GlowFilter id={ids.glow} color={color} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="week" {...xAxisProps} />
          <YAxis {...yAxisProps} {...niceY(maxOf(data, [metric]))} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip />} />
          <Area
            {...lineProps}
            dataKey={metric}
            name={metric === 'Views' ? 'Views' : 'New audience'}
            stroke={color}
            fill={`url(#${ids.area})`}
            filter={`url(#${ids.glow})`}
            activeDot={activeDot(color)}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ------------------------------------------------------------------
// Platform ranking: horizontal bars, sorted, value + share at the tip.
// Bars keep each platform's own colour (colour follows the entity).
// ------------------------------------------------------------------

export function PlatformBarChart({
  data,
  title = 'Views by platform',
  subtitle = 'All platforms, selected months',
}: {
  data: { name: string; color: string; views: number }[]
  title?: string
  subtitle?: string
}) {
  return (
    <RankBarChart
      title={title}
      subtitle={subtitle}
      valueName="Views"
      data={data.map((d) => ({ name: d.name, value: d.views, color: d.color }))}
    />
  )
}

/**
 * Horizontal ranking bars, largest first, with the value and its share
 * printed at the bar tip. Each row may carry its own colour (an entity
 * colour such as a platform's); otherwise all rows share `color`.
 */
export function RankBarChart({
  data,
  title,
  subtitle,
  valueName = 'Value',
  color = SERIES[0],
  maxRows = 8,
  className,
}: {
  data: { name: string; value: number; color?: string }[]
  title: string
  subtitle?: string
  valueName?: string
  color?: string
  /** Rows past this fold into "Other". */
  maxRows?: number
  className?: string
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const folded =
    sorted.length > maxRows
      ? [
          ...sorted.slice(0, maxRows - 1),
          { name: `Other (${sorted.length - maxRows + 1})`, value: sorted.slice(maxRows - 1).reduce((s, d) => s + d.value, 0), color: MUTED },
        ]
      : sorted
  const total = folded.reduce((s, d) => s + d.value, 0)
  const rows = folded.map((d) => ({ ...d, color: d.color ?? color, share: total ? Math.round((d.value / total) * 100) : 0 }))
  const ids = useGradientIds(rows.map((d, i) => `${i}-${d.name}`))
  const height = Math.min(Math.max(150, rows.length * 44 + 16), 320)

  return (
    <ChartCard title={title} subtitle={subtitle} height={height} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 84, bottom: 0, left: 0 }} barCategoryGap="30%">
          <defs>
            {rows.map((d, i) => (
              <linearGradient key={d.name} id={ids[`${i}-${d.name}`]} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={d.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={d.color} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridProps} vertical horizontal={false} />
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={116} tickMargin={10} tick={<CategoryTick />} />
          <Tooltip
            cursor={barCursor}
            content={
              <ChartTooltip
                colorFor={(e) => (e.payload?.color as string) ?? undefined}
                footer={(p) => `${(p[0]?.payload?.share as number) ?? 0}% of total`}
              />
            }
          />
          <Bar dataKey="value" name={valueName} radius={[0, 5, 5, 0]} maxBarSize={20} animationDuration={700}>
            {rows.map((d, i) => (
              <Cell key={d.name} fill={`url(#${ids[`${i}-${d.name}`]})`} />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => {
                const { x = 0, y = 0, width = 0, height: h = 0, index = 0 } = props as {
                  x?: number
                  y?: number
                  width?: number
                  height?: number
                  index?: number
                }
                const row = rows[index]
                if (!row) return null
                return (
                  <text x={Number(x) + Number(width) + 10} y={Number(y) + Number(h) / 2} dy={4} fontSize={12} fontFamily="Inter, system-ui">
                    <tspan fill={INK.primary} fontWeight={600}>
                      {compact(row.value)}
                    </tspan>
                    <tspan fill={INK.secondary} dx={6}>
                      {row.share}%
                    </tspan>
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ------------------------------------------------------------------
// Monthly bars: this year in the accent, comparison year muted behind it.
// ------------------------------------------------------------------

export function MonthlyCompareChart({
  data,
  currentLabel,
  compareLabel,
  showCompare,
  title = 'Monthly views',
}: {
  data: { month: string; current: number; prior: number }[]
  currentLabel: string
  compareLabel: string
  showCompare: boolean
  title?: string
}) {
  const ids = useGradientIds(['cur', 'prior'])
  const legend = [{ label: currentLabel, color: SERIES[0] }, ...(showCompare ? [{ label: compareLabel, color: MUTED }] : [])]
  return (
    <ChartCard title={title} aside={<ChartLegend items={legend} />}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin} barGap={2} barCategoryGap="22%">
          <defs>
            <BarGradient id={ids.cur} color={SERIES[0]} />
            <BarGradient id={ids.prior} color={MUTED} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...xAxisProps} tickFormatter={(m: string) => m.slice(0, 3)} />
          <YAxis {...yAxisProps} {...niceY(maxOf(data, showCompare ? ['current', 'prior'] : ['current']))} />
          <Tooltip cursor={barCursor} content={<ChartTooltip colorFor={(e) => (e.dataKey === 'prior' ? MUTED : SERIES[0])} />} />
          {showCompare && (
            <Bar dataKey="prior" name={compareLabel} fill={`url(#${ids.prior})`} {...barProps} maxBarSize={18} animationDuration={600} />
          )}
          <Bar dataKey="current" name={currentLabel} fill={`url(#${ids.cur})`} {...barProps} maxBarSize={18} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ------------------------------------------------------------------
// Content impact: two aligned charts sharing the week axis (no dual axis).
// ------------------------------------------------------------------

export function ContentImpactCharts({
  data,
}: {
  data: { week: string; 'Content Items': number; Views: number }[]
}) {
  const ids = useGradientIds(['bar', 'area', 'glow'])
  return (
    <ChartCard
      title="Content output vs. views, week by week"
      subtitle="Hover a week to compare both charts. They share the same weeks, so peaks line up."
      height={360}
      aside={
        <ChartLegend
          items={[
            { label: 'Content items', color: SERIES[1] },
            { label: 'Views', color: SERIES[0] },
          ]}
        />
      }
    >
      <div className="h-full flex flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400 mb-1">Content items</p>
        <div className="flex-[0_0_40%] min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} syncId="content-impact" margin={{ ...chartMargin, bottom: 0 }} barCategoryGap="30%">
              <defs>
                <BarGradient id={ids.bar} color={SERIES[1]} />
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="week" hide />
              <YAxis {...yAxisProps} allowDecimals={false} {...niceY(maxOf(data, ['Content Items']), { integer: true })} />
              <Tooltip cursor={barCursor} content={<ChartTooltip />} />
              <Bar dataKey="Content Items" name="Content items" fill={`url(#${ids.bar})`} {...barProps} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400 mt-3 mb-1">Views</p>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} syncId="content-impact" margin={chartMargin}>
              <defs>
                <AreaGradient id={ids.area} color={SERIES[0]} />
                <GlowFilter id={ids.glow} color={SERIES[0]} />
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="week" {...xAxisProps} />
              <YAxis {...yAxisProps} {...niceY(maxOf(data, ['Views']))} />
              <Tooltip cursor={lineCursor} content={<ChartTooltip />} />
              <Area
                {...lineProps}
                dataKey="Views"
                stroke={SERIES[0]}
                fill={`url(#${ids.area})`}
                filter={`url(#${ids.glow})`}
                activeDot={activeDot(SERIES[0])}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}

// ------------------------------------------------------------------
// Platform A vs B: two lines on one (shared) views axis.
// ------------------------------------------------------------------

export function PlatformVsChart({
  data,
  aName,
  bName,
  title = 'Monthly views',
}: {
  data: Record<string, string | number>[]
  aName: string
  bName: string
  title?: string
}) {
  const ids = useGradientIds(['a', 'b', 'ga', 'gb'])
  const a = SERIES[0]
  const b = SERIES[2]
  return (
    <ChartCard
      title={title}
      aside={
        <ChartLegend
          items={[
            { label: aName, color: a },
            { label: bName, color: b },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            <AreaGradient id={ids.a} color={a} strength={0.16} />
            <AreaGradient id={ids.b} color={b} strength={0.12} />
            <GlowFilter id={ids.ga} color={a} />
            <GlowFilter id={ids.gb} color={b} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...xAxisProps} />
          <YAxis {...yAxisProps} {...niceY(maxOf(data, [aName, bName]))} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip />} />
          <Area {...lineProps} dataKey={aName} stroke={a} fill={`url(#${ids.a})`} filter={`url(#${ids.ga})`} activeDot={activeDot(a)} />
          <Area {...lineProps} dataKey={bName} stroke={b} fill={`url(#${ids.b})`} filter={`url(#${ids.gb})`} activeDot={activeDot(b)} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
