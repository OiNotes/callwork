'use client'

import { motion } from '@/lib/motion'
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface FunnelStage {
  stage: string
  value: number
  teamAverage: number
  conversion?: number
  teamConversion?: number
  isAboveAverage: boolean
}

interface PersonalFunnelProps {
  funnel: FunnelStage[]
}

export function PersonalFunnel({ funnel }: PersonalFunnelProps) {
  if (!funnel || funnel.length === 0) {
    return (
      <EmptyState
        icon={<BarChart2 className="w-6 h-6" />}
        title="Нет данных"
        description="Данные появятся после создания отчётов"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-[var(--card)] rounded-2xl p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]"
    >
      <h3 className="text-lg font-semibold mb-6 text-[var(--foreground)]">Персональная воронка</h3>

      <div className="space-y-4">
        {funnel.map((stage) => (
          <div key={stage.stage} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-[var(--foreground)]">{stage.stage}</h4>
                {stage.isAboveAverage ? (
                  <TrendingUp className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-[var(--danger)]" />
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--foreground)]">{stage.value}</p>
                {stage.conversion !== undefined && (
                  <p className={`text-sm ${stage.isAboveAverage ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {stage.conversion}% конверсия
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-[var(--muted)]/40 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    stage.isAboveAverage ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                  }`}
                  style={{
                    width: `${stage.conversion !== undefined
                      ? stage.conversion
                      : (stage.value / (funnel[0]?.value || 1)) * 100
                    }%`
                  }}
                />
              </div>
              <span className="text-xs text-[var(--muted-foreground)] w-16 text-right">
                vs {stage.teamAverage}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
