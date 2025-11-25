'use client'

import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { formatMoney } from '@/lib/utils/format'
import { TrendingUp, Target, Zap } from 'lucide-react'

interface BulletChartProps {
  /** Fact revenue (paid deals) */
  fact: number
  /** Forecast revenue (fact + hot deals) */
  forecast: number
  /** Sales Plan */
  plan: number
  /** Commission Fact */
  salaryFact?: number
  /** Commission Forecast */
  salaryForecast?: number
  /** Chart Title */
  title?: string
  /** Loading state */
  loading?: boolean
  /** Refresh callback */
  onRefresh?: () => void
}

/**
 * Standard Stephen Few Bullet Chart
 *
 * Structure:
 * 1. Qualitative Ranges (Background): Poor (0-60%), Satisfactory (60-85%), Good (85-100%+) - Grayscale
 * 2. Feature Measure (Main Bar): Fact Revenue - High contrast color (Dark Blue/Primary)
 * 3. Comparative Measure (Marker): Plan Target - Vertical Line
 * 4. Projected Measure (Optional): Forecast - Lighter bar or Outline
 */
function BulletChartComponent({
  fact,
  forecast,
  plan,
  salaryFact,
  salaryForecast,
  title = 'Выполнение плана',
  loading = false,
}: BulletChartProps) {
  const safePlan = plan > 0 ? plan : 1
  
  // Scale: We typically show up to 120% or 150% of plan to handle overperformance
  const maxScale = Math.max(safePlan * 1.2, forecast * 1.1, fact * 1.1)

  const metrics = useMemo(() => {
    const factPercent = (fact / safePlan) * 100
    
    // Positions as percentages of the CONTAINER width (maxScale)
    const factWidth = (fact / maxScale) * 100
    const forecastWidth = (forecast / maxScale) * 100
    const planPos = (safePlan / maxScale) * 100

    // Zones (backgrounds)
    const poorEnd = (safePlan * 0.6 / maxScale) * 100
    const avgEnd = (safePlan * 0.85 / maxScale) * 100
    // goodEnd is 100% width

    return {
      factWidth,
      forecastWidth,
      planPos,
      poorEnd,
      avgEnd,
      factPercent,
      potentialGain: salaryForecast && salaryFact ? salaryForecast - salaryFact : 0,
    }
  }, [fact, forecast, plan, maxScale, salaryFact, salaryForecast])

  if (loading) {
    return (
      <div className="w-full h-[140px] animate-pulse bg-[var(--muted)]/20 rounded-xl" />
    )
  }

  return (
    <div className="glass-card p-6 border border-[var(--border)] rounded-xl shadow-sm bg-[var(--card)]">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
            {title}
          </h3>
          <div className="flex items-baseline gap-2">
             <span className="text-3xl font-black text-[var(--foreground)] tracking-tight tabular-nums">
                {Math.round(metrics.factPercent)}%
             </span>
             <span className="text-sm font-medium text-[var(--muted-foreground)]">
                от плана {formatMoney(plan)}
             </span>
          </div>
        </div>
        
        {/* Commission / Salary Stats (Compact) */}
        {salaryFact !== undefined && (
          <div className="text-right">
             <div className="text-xs text-[var(--muted-foreground)] mb-0.5">Комиссия</div>
             <div className="text-lg font-bold text-[var(--foreground)] tabular-nums">
               {formatMoney(salaryFact)}
             </div>
             {metrics.potentialGain > 0 && (
               <div className="text-xs font-medium text-[var(--success)]">
                 +{formatMoney(metrics.potentialGain)} прогноз
               </div>
             )}
          </div>
        )}
      </div>

      {/* The Bullet Chart */}
      <div className="relative h-8 w-full rounded-sm overflow-hidden select-none bg-[var(--muted)]/10">
        
        {/* 1. Qualitative Ranges (Backgrounds) */}
        {/* Zone 1: Poor (0-60%) - Darker Gray */}
        <div 
          className="absolute inset-y-0 left-0 bg-[var(--muted)]/40" 
          style={{ width: `${metrics.poorEnd}%` }} 
        />
        {/* Zone 2: Satisfactory (60-85%) - Medium Gray */}
        <div 
          className="absolute inset-y-0 bg-[var(--muted)]/20" 
          style={{ left: `${metrics.poorEnd}%`, width: `${metrics.avgEnd - metrics.poorEnd}%` }} 
        />
        {/* Zone 3: Good (85%+) - Lightest (already background) */}

        {/* 2. Projected Measure (Forecast) - Thin bar or lighter shade */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${metrics.forecastWidth}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute inset-y-[30%] left-0 bg-blue-200 dark:bg-blue-900/30 opacity-50 rounded-r-sm"
        />

        {/* 3. Feature Measure (Fact) - The main bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${metrics.factWidth}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-y-[10%] left-0 bg-[var(--primary)] rounded-r-sm shadow-sm"
        />

        {/* 4. Comparative Measure (Plan) - Vertical Line */}
        <div 
          className="absolute top-0 bottom-0 w-[3px] bg-black dark:bg-white z-10"
          style={{ left: `calc(${metrics.planPos}% - 1.5px)` }}
        >
           {/* Optional: Target Tick Label */}
        </div>
      </div>

      {/* Axis Labels */}
      <div className="relative h-6 mt-1 text-[10px] font-medium text-[var(--muted-foreground)]">
         <span className="absolute left-0">0</span>
         <span 
            className="absolute -translate-x-1/2" 
            style={{ left: `${metrics.planPos}%` }}
         >
            {formatMoney(plan)}
         </span>
         <span 
             className="absolute right-0"
         >
            {formatMoney(maxScale)}
         </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-[var(--muted-foreground)]">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[var(--primary)] rounded-sm" />
            <span>Факт</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-200 dark:bg-blue-900/30 rounded-sm" />
            <span>Прогноз</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-[var(--foreground)]" />
            <span>План</span>
         </div>
      </div>
    </div>
  )
}

export const BulletChart = memo(BulletChartComponent)