import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, getISOWeek, startOfISOWeek } from 'date-fns'
import { MONTH_NAMES } from '../types/database'

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

// ---------------------------------------------------------------------
// Growth Tracker helpers — replaces the auto-calculated columns
// (Year, Month, Week, Quarter) from the WEEKLY INPUT sheet.
// ---------------------------------------------------------------------

/** Snaps any date to the Monday that starts its week (matches the sheet's "Week Start"). */
export function mondayOfISO(iso: string): string {
  return format(startOfISOWeek(parseISO(iso)), 'yyyy-MM-dd')
}

/** Derives { year, month, week, quarter } from a week-start date, same as the sheet's formulas. */
export function weekMeta(weekStartIso: string): { year: number; month: string; week: number; quarter: string } {
  const d = parseISO(weekStartIso)
  const quarter = `Q${Math.floor(d.getMonth() / 3) + 1}`
  return {
    year: d.getFullYear(),
    month: format(d, 'MMMM'),
    week: getISOWeek(d),
    quarter,
  }
}

/**
 * Flags per-row anomalies, same rules as WEEKLY INPUT's "Check" column:
 * - "negative value" — new_audience for this platform/week is negative (net unfollows)
 * - "views spike" — this week's views are more than 5x the platform's previous week's views
 * Returns a map of row id -> list of flags (empty array if nothing to flag).
 */
export function detectAnomalies<T extends { id: string; platform_id: string; week_start: string; views: number; new_audience: number }>(
  rows: T[]
): Map<string, string[]> {
  const byPlatform = new Map<string, T[]>()
  for (const r of rows) {
    const list = byPlatform.get(r.platform_id) ?? []
    list.push(r)
    byPlatform.set(r.platform_id, list)
  }

  const flags = new Map<string, string[]>()
  for (const list of byPlatform.values()) {
    const sorted = [...list].sort((a, b) => a.week_start.localeCompare(b.week_start))
    sorted.forEach((row, i) => {
      const rowFlags: string[] = []
      if (row.new_audience < 0) rowFlags.push('negative value')
      const prev = sorted[i - 1]
      if (prev && prev.views > 0 && row.views > prev.views * 5) rowFlags.push('views spike')
      if (rowFlags.length > 0) flags.set(row.id, rowFlags)
    })
  }
  return flags
}

/**
 * Pearson correlation coefficient between two equal-length numeric series.
 * Returns null when there isn't enough variance/data to compute one (fewer
 * than 3 points, or either series is constant).
 */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length)
  if (n < 3) return null
  const xs = x.slice(0, n)
  const ys = y.slice(0, n)
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  if (denomX === 0 || denomY === 0) return null
  return num / Math.sqrt(denomX * denomY)
}

/** Human-readable label for a Pearson r value, agency-report style. */
export function describeCorrelation(r: number | null): string {
  if (r === null) return 'Not enough data yet'
  const abs = Math.abs(r)
  const strength = abs >= 0.7 ? 'Strong' : abs >= 0.4 ? 'Moderate' : abs >= 0.2 ? 'Weak' : 'No real'
  const direction = r >= 0 ? 'positive' : 'negative'
  return abs < 0.2 ? 'No real correlation' : `${strength} ${direction} correlation`
}

// ---------------------------------------------------------------------
// SJ Content Tracker "2026 Growth" sheet importer — parses that exact
// two-header-row, wide monthly layout (Totals/Averages columns, then a
// Views+Followers-style column pair per platform — YouTube being a
// 3-column LV/SV/Subs exception, LinkedIn using "Conn." instead of
// "Foll.", Podcast using "Downloads", Newsletter using "Opens"/"Subs")
// straight out of a copy-paste from Excel/Google Sheets.
// ---------------------------------------------------------------------

const MONTH_NAMES_FULL = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

interface MonthlyImportRow {
  client_id: string
  platform_id: string
  week_start: string
  year: number
  month: string
  week: number
  views: number
  new_audience: number
  created_by: string
}

interface MonthlyImportResult {
  rows: MonthlyImportRow[]
  matchedPlatforms: string[]
  unmatchedColumns: string[]
  monthsFound: number
  /** Rows where column A matched a "<Month> Total" label, regardless of whether any platform/data matched. Used to tell "bad paste" apart from "no matching platforms" or "all-zero data". */
  monthLabelsSeen: number
}

function splitCells(line: string): string[] {
  return line.includes('\t') ? line.split('\t') : line.split(',')
}

/**
 * Parses text copy-pasted straight from the "2026 Growth" sheet (or any
 * sheet following the same two-header-row layout) into weekly_metrics
 * upsert rows, one per client+platform+month.
 */
export function parseMonthlyWideReport(
  text: string,
  opts: { clientId: string; createdBy: string; year: number; platforms: { id: string; name: string }[] }
): MonthlyImportResult {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '')
  if (lines.length < 3) return { rows: [], matchedPlatforms: [], unmatchedColumns: [], monthsFound: 0, monthLabelsSeen: 0 }

  const categoryRaw = splitCells(lines[0])
  const subheader = splitCells(lines[1])

  // Forward-fill merged-cell blanks in the category row.
  const category: string[] = []
  let last = ''
  for (const c of categoryRaw) {
    const v = c.trim()
    if (v) last = v
    category.push(last)
  }

  // Stop at the second "Week or Month" column (start of the VPF/FPD block).
  let endCol = subheader.length
  for (let i = 1; i < subheader.length; i++) {
    if (subheader[i]?.trim().toLowerCase() === 'week or month') {
      endCol = i
      break
    }
  }

  // Group consecutive columns sharing the same category label.
  const groups: { name: string; cols: number[] }[] = []
  let i = 1
  while (i < endCol) {
    const name = category[i] ?? ''
    const cols = [i]
    let j = i + 1
    while (j < endCol && (category[j] ?? '') === name) {
      cols.push(j)
      j++
    }
    groups.push({ name, cols })
    i = j
  }

  function matchPlatform(name: string) {
    const clean = name.trim().toLowerCase().replace(/\s+/g, '')
    if (!clean || clean === 'totals' || clean === 'averages') return undefined
    return opts.platforms.find((p) => {
      const pClean = p.name.toLowerCase().replace(/\s+/g, '')
      return pClean === clean || pClean.includes(clean) || clean.includes(pClean)
    })
  }

  type MetricGroup = { platformId: string; platformName: string; viewCols: number[]; audienceCol: number }
  const metricGroups: MetricGroup[] = []
  const unmatchedColumns: string[] = []

  for (const g of groups) {
    if (!g.name || g.name.toLowerCase() === 'totals' || g.name.toLowerCase() === 'averages') continue
    const subs = g.cols.map((c) => (subheader[c] ?? '').trim())

    let viewCols: number[] | null = null
    let audienceCol: number | null = null
    if (subs.length === 3 && subs[2].toLowerCase() === 'subs') {
      // YouTube-style: LV + SV (views), Subs (audience)
      viewCols = [g.cols[0], g.cols[1]]
      audienceCol = g.cols[2]
    } else if (subs.length === 2 && ['views', 'downloads', 'opens'].includes(subs[0].toLowerCase())) {
      viewCols = [g.cols[0]]
      audienceCol = g.cols[1]
    } else {
      continue // a ratio/average group (VPF, FPD, etc.) — not raw data, skip
    }

    const platform = matchPlatform(g.name)
    if (!platform) {
      unmatchedColumns.push(g.name)
      continue
    }
    metricGroups.push({ platformId: platform.id, platformName: platform.name, viewCols, audienceCol })
  }

  const rows: MonthlyImportRow[] = []
  const matchedPlatforms = new Set<string>()
  let monthsFound = 0
  let monthLabelsSeen = 0

  for (let r = 2; r < lines.length; r++) {
    const cells = splitCells(lines[r])
    const label = (cells[0] ?? '').trim().toLowerCase().replace(/\s*total\s*$/, '')
    const monthIndex = MONTH_NAMES_FULL.indexOf(label)
    if (monthIndex === -1) continue
    monthLabelsSeen++

    const num = (col: number) => {
      const raw = (cells[col] ?? '').replace(/,/g, '').trim()
      const n = parseFloat(raw)
      return Number.isFinite(n) ? n : 0
    }

    let anyData = false
    const monthRows: MonthlyImportRow[] = []
    for (const mg of metricGroups) {
      const views = mg.viewCols.reduce((s, c) => s + num(c), 0)
      const new_audience = num(mg.audienceCol)
      if (views !== 0 || new_audience !== 0) anyData = true
      const week_start = `${opts.year}-${String(monthIndex + 1).padStart(2, '0')}-01`
      monthRows.push({
        client_id: opts.clientId,
        platform_id: mg.platformId,
        week_start,
        year: opts.year,
        month: MONTH_NAMES[monthIndex],
        week: weekMeta(week_start).week,
        views,
        new_audience,
        created_by: opts.createdBy,
      })
      matchedPlatforms.add(mg.platformName)
    }
    if (anyData) {
      rows.push(...monthRows)
      monthsFound++
    }
  }

  return {
    rows,
    matchedPlatforms: Array.from(matchedPlatforms),
    unmatchedColumns: Array.from(new Set(unmatchedColumns)),
    monthsFound,
    monthLabelsSeen,
  }
}