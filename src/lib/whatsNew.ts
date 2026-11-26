// Bump this whenever you add a new batch of items below — that's what
// makes the popup show up again for everyone, exactly once, until they
// dismiss it. Old version strings are harmless to leave in git history.
export const WHATS_NEW_VERSION = '2026-11-partnerlee-2.1'

export interface WhatsNewItem {
  title: string
  description: string
}

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    title: '📅 Log calendar: spot missed days',
    description:
      'Your dashboard now has a calendar of the month. Days you logged are green, missed workdays are red, and clicking a missed day opens the Daily Log for that date. Admins can see every assistant\'s calendar and who missed days.',
  },
  {
    title: '🗓️ Custom date ranges',
    description:
      'Pick any From/To dates on the dashboard, History and Growth reports, alongside quick ranges like This week and Last 30 days.',
  },
  {
    title: '✨ Every page refreshed',
    description:
      'History, Weekly input, Team, Clients, Platforms, Settings, the Activity log, Growth reports and the client report link all have the new 2.0 design.',
  },
  {
    title: '🎬 Short-form vs long-form videos',
    description:
      'When you log videos, count short-form and long-form separately. Dashboards, Production Reports and CSV exports now show the split. Older logs show their videos as "not specified" until edited.',
  },
  {
    title: '✨ Partnerlee 2.0: a fresh new look',
    description:
      'A cleaner layout across the whole app. The sidebar is grouped (Workspace, Growth, Admin), Growth pages have tabs along the top, and "Log today\'s work" is always one click away.',
  },
  {
    title: '🏠 A "Today" card on your dashboard',
    description:
      'See what you\'ve logged today, your streak, and how this week compares with last week at a glance.',
  },
  {
    title: '➕ Faster daily logging',
    description:
      'Tap – / + to count each content type, set its status with one tap, and pick Today or Yesterday in a click. A save bar stays at the bottom, and you\'ll see anything you already logged that day.',
  },
  {
    title: '⌨️ Shortcuts and a mobile tab bar',
    description:
      'Press ⌘K (Ctrl+K on Windows) to jump to any page, or N to start a new log. On phones, a bottom tab bar replaces the old full-screen menu.',
  },
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
