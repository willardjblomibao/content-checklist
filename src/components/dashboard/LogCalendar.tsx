import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, format, isAfter, startOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn, isWeekendDate } from '../../lib/utils'

export type DayState = 'logged' | 'missed' | 'today-open' | 'weekend' | 'future' | 'before-start' | 'outside'

export interface MonthSummary {
  workdays: number
  loggedWorkdays: number
  missed: string[]
}

function iso(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

/**
 * What a calendar day means for logging:
 *  - logged: at least one entry that day (weekends included)
 *  - missed: a past weekday with no entry, on/after the person's start date
 *  - today-open: today, nothing logged yet (not counted as missed)
 *  - weekend: Sat/Sun without an entry (a protected day off, never "missed")
 */
export function dayState(date: Date, counts: Map<string, number>, today: string, startDate: string): DayState {
  const d = iso(date)
  if ((counts.get(d) ?? 0) > 0) return 'logged'
  if (d > today) return 'future'
  if (d < startDate) return 'before-start'
  if (d === today) return 'today-open'
  if (isWeekendDate(date)) return 'weekend'
  return 'missed'
}

/** Missed workdays and workday coverage for one month. */
export function summarizeMonth(month: Date, counts: Map<string, number>, startDate: string, today = iso(new Date())): MonthSummary {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  let workdays = 0
  let loggedWorkdays = 0
  const missed: string[] = []
  for (const day of days) {
    const d = iso(day)
    if (d > today || d < startDate || isWeekendDate(day)) continue
    // Today only counts once something is logged — it isn't "missed" yet.
    const has = (counts.get(d) ?? 0) > 0
    if (d === today && !has) continue
    workdays++
    if (has) loggedWorkdays++
    else missed.push(d)
  }
  return { workdays, loggedWorkdays, missed }
}

/**
 * Month calendar of logging activity. Missed workdays are flagged and, when
 * `canBackfill` is set, link straight to the Daily Log for that date.
 */
export function LogCalendar({
  month,
  onMonthChange,
  counts,
  startDate,
  canBackfill,
  personLabel,
  loading,
}: {
  month: Date
  onMonthChange: (m: Date) => void
  /** Activity count per ISO date (items, or 1 for an other-work-only day). */
  counts: Map<string, number>
  /** Days before this (e.g. the account's creation date) are never "missed". */
  startDate: string
  /** Show "Log it" links on missed days (only for your own calendar). */
  canBackfill?: boolean
  /** "You" / an assistant's name, used in the summary sentence. */
  personLabel?: string
  loading?: boolean
}) {
  const today = iso(new Date())
  const summary = useMemo(() => summarizeMonth(month, counts, startDate, today), [month, counts, startDate, today])
  const gridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month]
  )
  const isCurrentMonth = format(month, 'yyyy-MM') === today.slice(0, 7)
  const nextDisabled = isAfter(startOfMonth(addMonths(month, 1)), new Date())
  const coverage = summary.workdays ? Math.round((summary.loggedWorkdays / summary.workdays) * 100) : 100
  const who = personLabel ?? 'You'

  return (
    <div className="bg-white border border-ink-100 rounded-2xl shadow-card overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="Previous month"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-semibold text-ink-900 w-[132px] text-center">{format(month, 'MMMM yyyy')}</span>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            disabled={nextDisabled}
            aria-label="Next month"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => onMonthChange(startOfMonth(new Date()))}
              className="ml-1 text-xs font-semibold text-pine-700 hover:underline"
            >
              Today
            </button>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-ink-900 tabular-nums">
            {summary.loggedWorkdays}/{summary.workdays} workdays
          </p>
          <p className="text-[11px] text-ink-500">{coverage}% logged</p>
        </div>
      </div>

      {/* missed banner */}
      <div className="px-5">
        {summary.missed.length > 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-clay-50 border border-clay-100 px-3.5 py-2.5">
            <AlertTriangle className="h-4 w-4 text-clay-600 mt-0.5 shrink-0" />
            <div className="min-w-0 text-[13px]">
              <p className="font-semibold text-clay-600">
                {who === 'You' ? 'You missed' : `${who} missed`} {summary.missed.length} workday{summary.missed.length === 1 ? '' : 's'} in{' '}
                {format(month, 'MMMM')}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {summary.missed.slice(0, 8).map((d) =>
                  canBackfill ? (
                    <Link
                      key={d}
                      to={`/daily-log?date=${d}`}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-clay-100 px-2 py-0.5 text-xs font-medium text-ink-700 hover:border-clay-500 hover:text-clay-600"
                    >
                      {format(new Date(d + 'T00:00:00'), 'EEE d')}
                      <Plus className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span key={d} className="rounded-md bg-white border border-clay-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                      {format(new Date(d + 'T00:00:00'), 'EEE d')}
                    </span>
                  )
                )}
                {summary.missed.length > 8 && <span className="text-xs text-ink-500 self-center">+{summary.missed.length - 8} more</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl bg-pine-50 border border-pine-100 px-3.5 py-2.5 text-[13px]">
            <Check className="h-4 w-4 text-pine-600 shrink-0" />
            <span className="font-semibold text-pine-800">
              {summary.workdays === 0 ? 'No workdays to log yet this month.' : 'Every workday logged so far. Nice!'}
            </span>
          </div>
        )}
      </div>

      {/* grid */}
      <div className={cn('px-4 pt-3 pb-4 transition-opacity', loading && 'opacity-50')}>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400 py-1">
              {d.slice(0, 2)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((day) => {
            const d = iso(day)
            const inMonth = d.slice(0, 7) === format(month, 'yyyy-MM')
            const state: DayState = inMonth ? dayState(day, counts, today, startDate) : 'outside'
            const count = counts.get(d) ?? 0
            const label = `${format(day, 'EEEE, MMMM d')}: ${
              state === 'logged'
                ? `logged (${count} item${count === 1 ? '' : 's'})`
                : state === 'missed'
                  ? 'not logged'
                  : state === 'today-open'
                    ? 'today, not logged yet'
                    : state === 'weekend'
                      ? 'weekend'
                      : state === 'future'
                        ? 'upcoming'
                        : ''
            }`
            const cell = (
              <div
                className={cn(
                  'relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center text-[13px] font-semibold transition-colors',
                  state === 'outside' && 'text-transparent',
                  state === 'logged' && 'bg-pine-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
                  state === 'missed' && 'bg-clay-50 text-clay-600 ring-1 ring-inset ring-clay-100',
                  state === 'missed' && canBackfill && 'hover:bg-clay-100 hover:ring-clay-500',
                  state === 'today-open' && 'bg-white text-amber-600 ring-2 ring-inset ring-amber-500',
                  state === 'weekend' && 'bg-ink-50 text-ink-400',
                  state === 'future' && 'text-ink-300',
                  state === 'before-start' && 'text-ink-300'
                )}
              >
                <span>{inMonth ? format(day, 'd') : ''}</span>
                {state === 'logged' && <span className="text-[10px] font-medium text-pine-100 leading-none mt-0.5">{count}</span>}
                {state === 'missed' && <span className="h-1 w-1 rounded-full bg-clay-500 mt-1" />}
                {state === 'today-open' && <span className="text-[9px] font-bold uppercase leading-none mt-0.5">Today</span>}
              </div>
            )
            if (canBackfill && (state === 'missed' || state === 'today-open')) {
              return (
                <Link key={d} to={`/daily-log?date=${d}`} title={`${label} · click to log`} aria-label={`${label}. Log it`}>
                  {cell}
                </Link>
              )
            }
            return (
              <div key={d} title={inMonth ? label : undefined} aria-label={inMonth ? label : undefined}>
                {cell}
              </div>
            )
          })}
        </div>

        {/* legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 px-1 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-pine-600" />Logged (items)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-clay-50 ring-1 ring-clay-500" />Missed workday</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] ring-2 ring-amber-500" />Today</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-ink-100" />Weekend</span>
        </div>
      </div>
    </div>
  )
}
