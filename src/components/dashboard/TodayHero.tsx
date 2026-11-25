import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Flame, Plus } from 'lucide-react'

/**
 * The first thing on both dashboards: what's been logged today, the streak,
 * and one obvious button to log (more) work.
 */
export function TodayHero({
  eyebrow = 'Today',
  headline,
  detail,
  chips,
  streak,
  ctaLabel,
  ctaTo = '/daily-log',
  ctaIsPrimaryAction,
}: {
  eyebrow?: string
  headline: ReactNode
  detail?: ReactNode
  chips?: { label: string; value: number }[]
  /** Hidden when undefined (e.g. on the team view). */
  streak?: number
  ctaLabel: string
  ctaTo?: string
  /** Shows a "+" instead of an arrow — used when nothing is logged yet. */
  ctaIsPrimaryAction?: boolean
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-800 via-pine-700 to-pine-600 text-white p-5 sm:p-6">
      {/* soft decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-pine-100/80">{eyebrow}</p>
          <p className="text-2xl sm:text-[30px] leading-tight font-bold tracking-tight mt-1.5">{headline}</p>
          {detail && <p className="text-sm text-pine-50/85 mt-1">{detail}</p>}
          {chips && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${c.value > 0 ? 'bg-white/20 text-white' : 'bg-white/10 text-pine-100/70'}`}
                >
                  {c.value} {c.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 sm:gap-7 shrink-0">
          {streak !== undefined && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Flame className="h-7 w-7 text-amber-400" fill="currentColor" />
                <span className="text-[32px] leading-none font-bold tabular-nums">{streak}</span>
              </div>
              <p className="text-xs text-pine-100/85 mt-1">day streak</p>
            </div>
          )}
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-pine-800 px-5 py-3 text-sm font-bold shadow-soft hover:bg-pine-50 transition-colors whitespace-nowrap flex-1 sm:flex-none justify-center"
          >
            {ctaIsPrimaryAction && <Plus className="h-4 w-4" />}
            {ctaLabel}
            {!ctaIsPrimaryAction && <ArrowRight className="h-4 w-4" />}
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Counts for the hero chips, grouped the way people talk about them. */
export function chipsFor(totals: Record<string, number>) {
  return [
    { label: 'videos', value: (totals.videos_edited_count ?? 0) + (totals.videos_reedited_count ?? 0) },
    { label: 'carousels', value: (totals.carousels_edited_count ?? 0) + (totals.carousels_reedited_count ?? 0) },
    { label: 'text posts', value: (totals.text_posts_prepared_count ?? 0) + (totals.text_posts_reedited_count ?? 0) },
  ]
}
