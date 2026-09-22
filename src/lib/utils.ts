import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string, pattern = 'MMM d, yyyy'): string {
  try {
    return format(parseISO(iso), pattern)
  } catch {
    return iso
  }
}

export function dayOfWeek(iso: string): string {
  try {
    return format(parseISO(iso), 'EEEE')
  } catch {
    return ''
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  const monday = new Date(d.setDate(diff))
  return format(monday, 'yyyy-MM-dd')
}

export function startOfMonthISO(): string {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')
}

export function isWeekendDate(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6 // Sunday, Saturday
}

/**
 * Current streak of consecutive days with activity, counting backward from
 * today. If today has no activity yet, that's not treated as "broken" —
 * the streak is measured through yesterday instead, since today isn't over.
 *
 * Weekends are "protected": a Saturday or Sunday with no logged activity
 * does not break the streak (it's simply skipped), though a weekend day
 * that *does* have activity still counts toward the total. Any missed
 * weekday still breaks the streak as before.
 */
export function computeStreak(countsByDate: Map<string, number>): number {
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  const todayIso = format(cursor, 'yyyy-MM-dd')
  if ((countsByDate.get(todayIso) ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  // Safety cap so a data/logic edge case can't spin forever.
  for (let i = 0; i < 3650; i++) {
    const iso = format(cursor, 'yyyy-MM-dd')
    const hasActivity = (countsByDate.get(iso) ?? 0) > 0

    if (hasActivity) {
      streak++
    } else if (isWeekendDate(cursor)) {
      // Protected day off — doesn't extend the streak, but doesn't break it either.
    } else {
      break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface DayProgress {
  date: string
  /** Two-letter day label, e.g. 'Mo', 'Tu' */
  dayLabel: string
  hasActivity: boolean
  isWeekend: boolean
  isToday: boolean
}

/**
 * Trailing window of days (oldest to newest, ending today) used to render
 * the "Weekly Progress" strip on the streak card.
 */
export function getWeekProgress(countsByDate: Map<string, number>, days = 7): DayProgress[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = format(today, 'yyyy-MM-dd')

  const result: DayProgress[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const iso = format(d, 'yyyy-MM-dd')
    result.push({
      date: iso,
      dayLabel: format(d, 'EEEEEE'),
      hasActivity: (countsByDate.get(iso) ?? 0) > 0,
      isWeekend: isWeekendDate(d),
      isToday: iso === todayIso,
    })
  }
  return result
}

/** Milestone thresholds shown as badges on the streak card. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60] as const