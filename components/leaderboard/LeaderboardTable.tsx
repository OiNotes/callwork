'use client'

import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LeaderboardItem {
  id: string
  name: string
  deals: number
  sales: number
  avgCheck: number
  goalProgress: number | null
  finalConversion: number
  rank: number
  medal?: 'gold' | 'silver' | 'bronze'
}

interface LeaderboardTableProps {
  leaderboard: LeaderboardItem[]
  period: 'day' | 'week' | 'month'
  onPeriodChange: (period: string) => void
}

export function LeaderboardTable({ leaderboard, period, onPeriodChange }: LeaderboardTableProps) {
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0
    }).format(value)
  }

  return (
    <div className="space-y-4">
      {/* Compact Tabs */}
      <div className="flex gap-1 bg-[var(--muted)]/30 p-1 rounded-lg w-fit">
        {['day', 'week', 'month'].map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium transition-all",
              period === p
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="border rounded-lg border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] overflow-hidden">
        {leaderboard.map((item, idx) => (
            <motion.div 
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-3 p-3 hover:bg-[var(--muted)]/20 transition-colors text-sm"
            >
                {/* Rank */}
                <div className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0",
                    item.rank === 1 ? "bg-yellow-500 text-white" :
                    item.rank === 2 ? "bg-slate-400 text-white" :
                    item.rank === 3 ? "bg-orange-700 text-white" :
                    "bg-[var(--muted)] text-[var(--muted-foreground)]"
                )}>
                    {item.rank}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 font-medium text-[var(--foreground)] truncate flex items-center gap-2">
                    {item.name}
                    {item.medal === 'gold' && <Trophy className="w-3 h-3 text-yellow-500" />}
                </div>

                {/* Metrics Grid */}
                <div className="flex items-center gap-6 text-right">
                    <div className="hidden sm:block w-24">
                        <div className="text-[var(--foreground)]">{item.deals}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">сделок</div>
                    </div>
                    
                    <div className="hidden sm:block w-24">
                        <div className="text-[var(--foreground)]">{formatMoney(item.avgCheck)}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">ср. чек</div>
                    </div>

                    <div className="w-28">
                        <div className="text-[var(--primary)] font-bold">{formatMoney(item.sales)}</div>
                        {item.goalProgress !== null && (
                            <div className="text-[10px] text-[var(--success)] font-medium">
                                {item.goalProgress}% цели
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        ))}
      </div>
    </div>
  )
}
