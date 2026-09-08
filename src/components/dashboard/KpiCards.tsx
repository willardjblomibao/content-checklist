import { Video, Repeat, GalleryHorizontal, FileText, Layers } from 'lucide-react'
import { Card } from '../ui/primitives'
import { PRODUCTION_FIELDS } from '../../types/database'

export type RangeKey = 'today' | 'week' | 'month' | 'custom'

const ICONS = [Video, Repeat, GalleryHorizontal, Repeat, FileText, Repeat]

export function KpiCards({ totals }: { totals: Record<string, number> }) {
  const items = [
    ...PRODUCTION_FIELDS.map((f, i) => ({
      label: f.label,
      value: totals[f.countKey] ?? 0,
      icon: ICONS[i],
    })),
    {
      label: 'Total Items',
      value: Object.values(totals).reduce((a, b) => a + b, 0),
      icon: Layers,
      highlight: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card
          key={item.label}
          className={item.highlight ? 'bg-gradient-to-br from-pine-600 to-pine-900 border-transparent' : ''}
        >
          <div className="px-4 py-4 flex items-start gap-3">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                item.highlight ? 'bg-white/15 text-white' : 'bg-pine-50 text-pine-700'
              }`}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className={`text-xs font-medium ${item.highlight ? 'text-pine-100' : 'text-ink-500'}`}>
                {item.label}
              </span>
              <p className={`text-2xl font-semibold mt-1 ${item.highlight ? 'text-white' : 'text-ink-900'}`}>
                {item.value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function RangeSwitcher({
  value,
  onChange,
}: {
  value: RangeKey
  onChange: (v: RangeKey) => void
}) {
  const options: { key: RangeKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
  ]
  return (
    <div className="inline-flex rounded-full border border-ink-100 bg-white p-1 shadow-soft">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors ${
            value === o.key
              ? 'bg-gradient-to-b from-pine-500 to-pine-700 text-white'
              : 'text-ink-600 hover:bg-pine-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
