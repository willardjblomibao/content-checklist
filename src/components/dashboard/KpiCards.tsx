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
        <Card key={item.label} className={item.highlight ? 'border-pine-200 bg-pine-50' : ''}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-ink-500">
              <item.icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
            <p className={`text-2xl font-semibold mt-1.5 ${item.highlight ? 'text-pine-800' : 'text-ink-900'}`}>
              {item.value}
            </p>
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
    <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-[6px] transition-colors ${
            value === o.key ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
