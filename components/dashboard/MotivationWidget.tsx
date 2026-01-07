'use client'

import { useMemo } from 'react'
import { RefreshCcw, Wallet } from 'lucide-react'
import { formatMoney, formatNumber } from '@/lib/utils/format'
import { MotivationCalculationResult } from '@/lib/motivation/motivationCalculator'
import { MotivationGradeConfig } from '@/lib/config/motivationGrades'
import { cn } from '@/lib/utils/cn'
import { calcPercent, roundPercent, toDecimal } from '@/lib/utils/decimal'

interface MotivationWidgetProps {
  title: string
  data?: MotivationCalculationResult | null
  grades?: MotivationGradeConfig[]
  loading?: boolean
  onRefresh?: () => void
}

export function MotivationWidget({ title, data, grades = [], loading, onRefresh }: MotivationWidgetProps) {
  const maxScale = useMemo(() => {
    const finiteGrades = grades.map(g => g.maxTurnover || g.minTurnover).filter(Boolean) as number[]
    const ceiling = Math.max(...finiteGrades, data?.totalPotentialTurnover || 0, 1)
    return ceiling
  }, [grades, data])

  const scaleDecimal = useMemo(() => toDecimal(maxScale), [maxScale])
  const currentPct = useMemo(() => {
    if (scaleDecimal.isZero()) return 0
    return Math.min(100, roundPercent(calcPercent(toDecimal(data?.factTurnover || 0), scaleDecimal)))
  }, [data, scaleDecimal])
  const forecastPct = useMemo(() => {
    if (scaleDecimal.isZero()) return 0
    return Math.min(100, roundPercent(calcPercent(toDecimal(data?.totalPotentialTurnover || 0), scaleDecimal)))
  }, [data, scaleDecimal])
  const thresholds = useMemo(() => {
    if (scaleDecimal.isZero()) return []
    return grades.filter(g => g.minTurnover > 0).map(g => ({
      val: g.minTurnover,
      pos: Math.min(100, roundPercent(calcPercent(toDecimal(g.minTurnover), scaleDecimal)))
    }))
  }, [grades, scaleDecimal])

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      {/* Header + Refresh */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <Wallet className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        </div>
        <button 
            onClick={onRefresh} 
            disabled={loading}
            aria-label="Обновить данные мотивации"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 -mr-1"
        >
            <RefreshCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex justify-between items-end mb-3">
        {/* Fact */}
        <div>
            <div className="text-2xl font-bold text-[var(--foreground)] tracking-tight leading-none">
                {formatMoney(data?.salaryFact || 0)}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                Факт: {formatMoney(data?.factTurnover || 0)}
            </div>
        </div>

        {/* Forecast */}
        <div className="text-right">
            <div className="text-lg font-bold text-[var(--success)] leading-none">
                {formatMoney(data?.salaryForecast || 0)}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                Потенциал: {formatMoney(data?.totalPotentialTurnover || 0)}
            </div>
        </div>
      </div>

      {/* Slim Progress Bar */}
      <div className="relative h-2 mb-4">
          <div className="absolute inset-0 bg-[var(--muted)] rounded-full overflow-hidden">
              {/* Forecast */}
              <div 
                className="absolute h-full bg-[var(--success)]/30 transition-all duration-500" 
                style={{ width: `${forecastPct}%` }} 
              />
              {/* Fact */}
              <div 
                className="absolute h-full bg-[var(--primary)] transition-all duration-500" 
                style={{ width: `${currentPct}%` }} 
              />
          </div>
          
          {/* Ticks */}
          {thresholds.map((t, i) => (
              <div 
                key={t.val} 
                className="absolute top-0 bottom-0 w-px bg-[var(--card)] z-10"
                style={{ left: `${t.pos}%` }} 
              />
          ))}
      </div>

      {/* Legend / Ticks Labels */}
      <div className="flex justify-between text-[9px] text-[var(--muted-foreground)]">
          <span>0</span>
          <div className="flex gap-4">
             {thresholds.slice(-2).map(t => (
                 <span key={t.val}>{formatNumber(t.val)}</span>
             ))}
          </div>
      </div>
    </div>
  )
}
