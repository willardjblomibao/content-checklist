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

/**
 * Current streak of consecutive days with activity, counting backward from
 * today. If today has no activity yet, that's not treated as "broken" —
 * the streak is measured through yesterday instead, since today isn't over.
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
    if ((countsByDate.get(iso) ?? 0) <= 0) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
