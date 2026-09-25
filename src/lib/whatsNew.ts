// Bump this whenever you add a new batch of items below — that's what
// makes the popup show up again for everyone, exactly once, until they
// dismiss it. Old version strings are harmless to leave in git history.
export const WHATS_NEW_VERSION = '2026-09-growth-tracker-5'

export interface WhatsNewItem {
  title: string
  description: string
}

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    title: '📥 Import Monthly Report',
    description:
      'Weekly Growth Input now has an "Import Monthly Report" option that reads a copy-paste straight from a "20XX Growth"-style sheet (two header rows, per-platform Views/Followers columns) — no reformatting needed.',
  },
  {
    title: '🆚 Platform vs Platform',
    description:
      'Pick any two platforms for a client and compare Views, Followers, Views-per-Follower and Followers-per-Day side by side, month by month — with CSV, Excel and PDF export built in.',
  },
  {
    title: '⚡ Content Impact',
    description:
      'A new page under Growth that lines up your Daily Log output against Weekly Growth results, week by week — plus a correlation score that tells you whether more content actually moves views (same week, or with a delay).',
  },
  {
    title: '👥 Multiple clients per employee',
    description: 'Assign one employee to several clients from the Team page — they\'ll get a client switcher scoped to just their own list.',
  },
  {
    title: '📊 12-KPI Growth Dashboard',
    description: 'Platform and month-range filters, plus Peak Audience, Audience Added, Best Week, and more — matching the original workbook\'s DASHBOARD tab.',
  },
]
