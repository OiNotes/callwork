'use client'

import { memo, useMemo } from 'react'
import { motion } from '@/lib/motion'
import { FunnelStage } from '@/lib/analytics/funnel.client'
import { ChevronRight } from 'lucide-react'

interface FunnelChartProps {
  data: FunnelStage[]
  error?: string | null
  onRetry?: () => void
}

/**
 * Clean Executive Funnel Chart
 * 
 * Changes:
 * - Monochromatic Blue palette (professional)
 * - Conversion rates placed BETWEEN nodes
 * - Removed "Red Arrow" noise
 * - Simplified layout
 */
function FunnelChartComponent({ data, error, onRetry }: FunnelChartProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-sm text-[var(--danger)] mb-3">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-primary">
            Повторить
          </button>
        )}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]">
        <p>Нет данных для воронки</p>
      </div>
    )
  }

  const maxVal = data[0]?.value || 1

  const stagesWithStats = useMemo(() => {
    return data.map((stage, index) => {
      const prevStage = index > 0 ? data[index - 1] : null
      const conversion = prevStage && prevStage.value > 0
        ? Math.round((stage.value / prevStage.value) * 100)
        : 100
      
      return {
        ...stage,
        conversion,
        // Minimum width to ensure text fits
        widthPercent: Math.max(15, (stage.value / maxVal) * 100)
      }
    })
  }, [data, maxVal])

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 w-full overflow-x-auto pb-2">
        {stagesWithStats.map((stage, index) => {
          const isFirst = index === 0
          
          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-[100px]">
              
              {/* Connector & Conversion Rate (between stages) */}
              {!isFirst && (
                <div className="flex flex-col items-center justify-center px-2 w-16 shrink-0">
                   <span className="text-[10px] font-bold text-[var(--muted-foreground)] mb-1">
                      {stage.conversion}%
                   </span>
                   <div className="w-full h-[1px] bg-[var(--border)] relative">
                      <ChevronRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-[var(--muted-foreground)] bg-[var(--card)]" />
                   </div>
                </div>
              )}

              {/* Stage Box */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex-1 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-3 min-h-[80px] flex flex-col justify-between hover:border-[var(--primary)]/40 transition-colors"
              >
                 <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] truncate">
                    {stage.label}
                 </div>
                 <div className="mt-2">
                    <div className="text-xl font-bold text-[var(--foreground)] tabular-nums">
                       {stage.value.toLocaleString('ru-RU')}
                    </div>
                    {/* Sub-text (e.g., % of total if needed, or delta) */}
                    {isFirst && (
                       <div className="text-[10px] text-[var(--muted-foreground)]">
                          100%
                       </div>
                    )}
                 </div>
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const FunnelChart = memo(FunnelChartComponent)
