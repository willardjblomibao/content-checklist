import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Flame } from 'lucide-react'
import { computeStreak, formatDate } from '../../lib/utils'

interface DayCell {
  date: string
  count: number | null // null = future day, not yet happened
}

const LEVEL_CLASSES = ['bg-ink-100', 'bg-pine-200', 'bg-pine-400', 'bg-pine-600', 'bg-pine-800']

function levelFor(count: number, max: number): number {
  if (count <= 0) return 0
  const ratio = count / Math.max(max, 1)
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function buildWeeks(countsByDate: Map<string, number>, weeksCount: number): DayCell[][] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Extend the grid out to the Saturday of the current week so every
  // column is a full Sun–Sat week, like GitHub's graph.
  const gridEnd = new Date(today)
  gridEnd.setDate(today.getDate() + (6 - today.getDay()))

  const totalDays = weeksCount * 7
  const gridStart = new Date(gridEnd)
  gridStart.setDate(gridEnd.getDate() - totalDays + 1)

  const weeks: DayCell[][] = []
  const cursor = new Date(gridStart)
  for (let w = 0; w < weeksCount; w++) {
    const week: DayCell[] = []
    for (let d = 0; d < 7; d++) {
      const iso = format(cursor, 'yyyy-MM-dd')
      const isFuture = cursor > today
      week.push({ date: iso, count: isFuture ? null : countsByDate.get(iso) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

export function ContributionHeatmap({
  countsByDate,
  weeks = 14,
  label = 'items',
}: {
  /** map of 'yyyy-MM-dd' -> count for that day */
  countsByDate: Map<string, number>
  weeks?: number
  label?: string
}) {
  const [hovered, setHovered] = useState<DayCell | null>(null)

  const grid = useMemo(() => buildWeeks(countsByDate, weeks), [countsByDate, weeks])
  const max = useMemo(() => Math.max(0, ...Array.from(countsByDate.values())), [countsByDate])
  const streak = useMemo(() => computeStreak(countsByDate), [countsByDate])

  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = []
    let lastMonth = ''
    grid.forEach((week, i) => {
      const firstDay = week[0]
      const month = firstDay.date.slice(0, 7) // yyyy-MM
      if (month !== lastMonth) {
        labels.push({ weekIndex: i, label: format(new Date(firstDay.date), 'MMM') })
        lastMonth = month
      }
    })
    return labels
  }, [grid])

  const totalInRange = useMemo(
    () => Array.from(countsByDate.values()).reduce((a, b) => a + b, 0),
    [countsByDate]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-500">
          <span className="font-semibold text-ink-900">{totalInRange}</span> {label} in the last {weeks} weeks
        </p>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            <Flame className="h-3.5 w-3.5" />
            {streak} day{streak === 1 ? '' : 's'} streak
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="flex gap-[3px] mb-1 relative h-4">
            {monthLabels.map(({ weekIndex, label }) => (
              <span
                key={weekIndex + label}
                className="absolute text-[10px] text-ink-400"
                style={{ left: weekIndex * 14 }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered((h) => (h?.date === day.date ? null : h))}
                    className={`h-[11px] w-[11px] rounded-[2px] ${
                      day.count === null ? 'bg-transparent' : LEVEL_CLASSES[levelFor(day.count, max)]
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="h-4 text-xs text-ink-500">
          {hovered && hovered.count !== null && (
            <span>
              <span className="font-medium text-ink-800">{hovered.count}</span> {label} on{' '}
              {formatDate(hovered.date, 'MMM d, yyyy')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-ink-400">
          <span>Less</span>
          {LEVEL_CLASSES.map((c) => (
            <span key={c} className={`h-[10px] w-[10px] rounded-[2px] ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
