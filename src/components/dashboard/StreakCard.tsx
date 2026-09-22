import { useMemo } from 'react'
import { Flame, Check, Snowflake, Award } from 'lucide-react'
import { Card } from '../ui/primitives'
import { computeStreak, getWeekProgress, STREAK_MILESTONES } from '../../lib/utils'

function messageFor(streak: number): string {
  if (streak === 0) return 'Log your work today to start a new streak.'
  if (streak < 3) return "Nice start — keep it going!"
  if (streak < 7) return "You're building momentum. Keep it up!"
  if (streak < 14) return "A full week+ streak — you're on fire!"
  if (streak < 30) return "Incredible consistency. Don't stop now!"
  return "Legendary streak. You've made this a habit!"
}

export function StreakCard({ countsByDate }: { countsByDate: Map<string, number> }) {
  const streak = useMemo(() => computeStreak(countsByDate), [countsByDate])
  const week = useMemo(() => getWeekProgress(countsByDate, 7), [countsByDate])

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-amber-50 to-white px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold bg-gradient-to-br from-amber-600 to-clay-600 bg-clip-text text-transparent">
              {streak}
            </span>
            <span className="text-sm font-semibold text-ink-700">
              Day{streak === 1 ? '' : 's'} Streak!
            </span>
          </div>
          <p className="text-xs text-ink-500 mt-1 max-w-[220px]">{messageFor(streak)}</p>
        </div>
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-clay-500 flex items-center justify-center shadow-soft shrink-0">
          <Flame className="h-7 w-7 text-white" fill="currentColor" />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-ink-100">
        <p className="text-xs font-semibold text-ink-700 mb-2.5">Weekly Progress</p>
        <div className="flex items-center justify-between">
          {week.map((day) => {
            const isMiss = !day.hasActivity && !day.isWeekend && !day.isToday

            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5">
                <span
                  className={`text-[10px] font-medium ${
                    day.isToday ? 'text-amber-600' : 'text-ink-400'
                  }`}
                >
                  {day.dayLabel}
                </span>
                <div
                  title={
                    day.hasActivity
                      ? 'Logged'
                      : day.isWeekend
                        ? 'Weekend — streak protected'
                        : day.isToday
                          ? "Today — not logged yet"
                          : 'Missed'
                  }
                  className={`h-8 w-8 rounded-full flex items-center justify-center ring-2 ${
                    day.hasActivity
                      ? 'bg-gradient-to-br from-amber-400 to-amber-500 ring-amber-200 text-white'
                      : day.isWeekend
                        ? 'bg-pine-50 ring-pine-100 text-pine-500'
                        : day.isToday
                          ? 'bg-white ring-amber-400 text-amber-500'
                          : 'bg-ink-50 ring-ink-100 text-ink-300'
                  }`}
                >
                  {day.hasActivity ? (
                    <Check className="h-4 w-4" />
                  ) : day.isWeekend ? (
                    <Snowflake className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[11px] font-semibold">{isMiss ? '·' : ''}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-ink-100">
        <p className="text-xs font-semibold text-ink-700 mb-2.5">Milestones</p>
        <div className="flex items-center justify-between">
          {STREAK_MILESTONES.map((milestone) => {
            const achieved = streak >= milestone
            return (
              <div key={milestone} className="flex flex-col items-center gap-1">
                <div
                  className={`h-10 w-10 flex items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] ${
                    achieved
                      ? 'bg-gradient-to-br from-pine-500 to-pine-700 text-white'
                      : 'bg-ink-100 text-ink-400'
                  }`}
                >
                  {achieved ? (
                    <span className="text-xs font-bold">{milestone}</span>
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}