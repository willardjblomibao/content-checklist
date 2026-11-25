import { Video, GalleryHorizontal, FileText, Repeat, Layers } from 'lucide-react'
import { Segmented, StatCard } from '../ui/primitives'
import { percentChange } from '../../lib/utils'

export type RangeKey = 'today' | 'week' | 'month'

const COMPARE_LABEL: Record<RangeKey, string> = {
  today: 'vs yesterday',
  week: 'vs last week',
  month: 'vs last month',
}

function sum(t: Record<string, number>, keys: string[]) {
  return keys.reduce((s, k) => s + (t[k] ?? 0), 0)
}

const TILES = [
  { label: 'Videos edited', keys: ['videos_edited_count'], icon: Video },
  { label: 'Carousels edited', keys: ['carousels_edited_count'], icon: GalleryHorizontal },
  { label: 'Text posts prepared', keys: ['text_posts_prepared_count'], icon: FileText },
  {
    label: 'Re-edits',
    keys: ['videos_reedited_count', 'carousels_reedited_count', 'text_posts_reedited_count'],
    icon: Repeat,
    // Fewer re-edits is the good direction.
    lowerIsBetter: true,
  },
] as const

/**
 * Production totals for the selected range: a highlighted "Total items" tile
 * plus one tile per content type. Re-edits for all three types are rolled
 * into one tile. When `previous` is given, each tile shows the change
 * against the same span one period earlier.
 */
export function KpiCards({
  totals,
  previous,
  range,
  videoSplit,
}: {
  totals: Record<string, number>
  previous?: Record<string, number>
  range: RangeKey
  /** Short/long-form split of the "Videos edited" tile. */
  videoSplit?: { short: number; long: number }
}) {
  const allKeys = Object.keys(totals)
  const tiles = [
    { label: 'Total items', keys: allKeys as readonly string[], icon: Layers, highlight: true, lowerIsBetter: false },
    ...TILES.map((t) => ({ ...t, highlight: false, lowerIsBetter: 'lowerIsBetter' in t ? t.lowerIsBetter : false })),
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {tiles.map((tile, i) => {
        const value = sum(totals, [...tile.keys])
        let delta: string | undefined
        let hint: 'up' | 'down' | 'flat' | undefined
        let good: boolean | undefined
        if (previous) {
          const prev = sum(previous, [...tile.keys])
          const pct = percentChange(value, prev)
          if (pct === null) {
            delta = `New ${COMPARE_LABEL[range]}`
            hint = 'up'
            good = !tile.lowerIsBetter
          } else if (pct === 0) {
            delta = `Same as ${COMPARE_LABEL[range].replace('vs ', '')}`
            hint = 'flat'
          } else {
            delta = `${Math.abs(pct)}% ${COMPARE_LABEL[range]}`
            hint = pct > 0 ? 'up' : 'down'
            good = tile.lowerIsBetter ? pct < 0 : pct > 0
          }
        }
        const Icon = tile.icon
        return (
          <StatCard
            key={tile.label}
            label={tile.label}
            value={value}
            delta={delta}
            hint={hint}
            deltaGood={good}
            icon={<Icon className="h-3.5 w-3.5" />}
            highlight={tile.highlight}
            sub={
              tile.label === 'Videos edited' && videoSplit && videoSplit.short + videoSplit.long > 0
                ? `${videoSplit.short} short · ${videoSplit.long} long`
                : undefined
            }
            className={i === 0 ? 'col-span-2 lg:col-span-1' : ''}
          />
        )
      })}
    </div>
  )
}

export function RangeSwitcher({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <Segmented
      ariaLabel="Date range"
      value={value}
      onChange={onChange}
      options={[
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This week' },
        { value: 'month', label: 'This month' },
      ]}
    />
  )
}
