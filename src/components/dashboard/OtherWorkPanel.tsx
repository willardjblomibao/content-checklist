import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { Card } from '../ui/primitives'
import { formatDate } from '../../lib/utils'
import type { ProductionLogWithRelations } from '../../types/database'

const MAX_ROWS = 5

/**
 * Other Work section for the dashboards. Same data, two views:
 *  - mode="self": an assistant's own non-production entries (what they worked on)
 *  - mode="team": every assistant's entries, with a per-person tally so an
 *    admin can see who is spending time on non-client work and on what.
 * Amber styling keeps it visually separate from the green production widgets.
 */
export function OtherWorkPanel({
  logs,
  mode,
}: {
  logs: ProductionLogWithRelations[]
  mode: 'self' | 'team'
}) {
  const entries = logs
    .filter((l) => l.is_other_work)
    .sort((a, b) => b.production_date.localeCompare(a.production_date))
  const days = new Set(entries.map((e) => e.production_date)).size

  const perPerson = new Map<string, number>()
  if (mode === 'team') {
    for (const e of entries) {
      const name = e.profile?.full_name ?? 'Unknown'
      perPerson.set(name, (perPerson.get(name) ?? 0) + 1)
    }
  }
  const tally = Array.from(perPerson, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  return (
    <Card className="overflow-hidden border-amber-100">
      <div className="flex items-center gap-3 px-5 py-4 bg-amber-50">
        <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <Briefcase className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            <span className="font-normal text-ink-500">
              {' · '}
              {days} {days === 1 ? 'day' : 'days'}
              {mode === 'team' && ` · ${tally.length} ${tally.length === 1 ? 'assistant' : 'assistants'}`}
            </span>
          </p>
          <p className="text-xs text-ink-500 mt-0.5">
            {mode === 'self' ? 'Non-production work you logged' : 'Non-production work logged by the team'}
          </p>
        </div>
      </div>

      {mode === 'team' && tally.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-t border-amber-100">
          {tally.map((t) => (
            <span
              key={t.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600"
            >
              {t.name}
              <span className="text-ink-700">{t.count}</span>
            </span>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-500 border-t border-amber-100">
          No Other Work logged in this period.
        </p>
      ) : (
        <div className="divide-y divide-ink-100 border-t border-amber-100">
          {entries.slice(0, MAX_ROWS).map((e) => (
            <Link
              key={e.id}
              to={`/daily-log?edit=${e.id}`}
              className="block px-5 py-3 hover:bg-amber-50/50"
            >
              <p className="text-xs text-ink-500 flex flex-wrap items-center gap-x-1.5">
                {mode === 'team' && <span className="font-medium text-ink-700">{e.profile?.full_name ?? 'Unknown'}</span>}
                {mode === 'team' && <span>·</span>}
                <span>{formatDate(e.production_date)}</span>
                {e.client?.name && (
                  <span className="rounded-full bg-white border border-amber-100 px-2 py-px text-amber-600 font-medium">
                    {e.client.name}
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-800 mt-0.5 line-clamp-2">{e.notes}</p>
            </Link>
          ))}
          {entries.length > MAX_ROWS && (
            <Link to="/history" className="block px-5 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50/50">
              +{entries.length - MAX_ROWS} more — view all in History
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
