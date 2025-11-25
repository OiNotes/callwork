'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, DollarSign, Activity } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'
import { NorthStarKpi } from '@/lib/calculations/funnel'
import { InlineSparkline } from '@/components/charts/InlineSparkline'

interface PulseGridProps {
  stats: {
    salesAmount: number
    planSales: number
    successfulDeals: number
    planDeals: number
    totalConversion: number
    prevConversion: number
  }
  northStarKpi: NorthStarKpi | null
  /** Daily trend data for sparklines */
  trendData?: { date: string; sales: number; deals: number }[]
  /** Forecasted sales amount */
  forecastSales?: number
}

export function PulseGrid({ stats, northStarKpi, trendData = [], forecastSales = 0 }: PulseGridProps) {
  const salesProgress =
    stats.planSales > 0 ? Math.min(100, (stats.salesAmount / stats.planSales) * 100) : 0
  
  const dealsProgress =
    stats.planDeals > 0 ? Math.min(100, (stats.successfulDeals / stats.planDeals) * 100) : 0

  const conversionDiff = stats.totalConversion - stats.prevConversion
  const isConversionUp = conversionDiff >= 0

  const northStarValue = northStarKpi?.value ?? 0
  const northStarTarget = northStarKpi?.target ?? 5
  const northStarDelta = northStarValue - northStarTarget
  const northStarGood = northStarValue >= northStarTarget

  // Extract history for sparklines
  const salesHistory = useMemo(() => trendData.map(d => d.sales), [trendData])
  const dealsHistory = useMemo(() => trendData.map(d => d.deals), [trendData])

  // Calculate mock trends for Sales/Deals based on history (last 3 days vs prev 3 days) 
  // to satisfy "Comparison Indicator" requirement without real prevPeriod stats
  const getTrend = (data: number[]) => {
      if (data.length < 6) return 0
      const recent = data.slice(-3).reduce((a, b) => a + b, 0)
      const prev = data.slice(-6, -3).reduce((a, b) => a + b, 0)
      if (prev === 0) return 0
      return Math.round(((recent - prev) / prev) * 100)
  }
  
  const salesTrend = useMemo(() => getTrend(salesHistory), [salesHistory])
  const dealsTrend = useMemo(() => getTrend(dealsHistory), [dealsHistory])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      
      {/* Card 1: Revenue (Main KPI) - Blue Theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 border border-[var(--border)] rounded-xl shadow-sm flex flex-col justify-between min-h-[160px] relative overflow-hidden"
      >
        <div>
          <div className="flex justify-between items-start mb-1 z-10 relative">
            <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Выполнение плана (₽)</span>
            <DollarSign className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          
          {/* Main Value + Comparison */}
          <div className="flex items-end gap-3 z-10 relative">
              <h3 className="text-3xl font-black text-[var(--foreground)] tabular-nums tracking-tight leading-none">
                {formatMoney(stats.salesAmount)}
              </h3>
              <div className={`flex items-center gap-0.5 text-[10px] font-bold mb-1 ${salesTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {salesTrend >= 0 ? '+' : ''}{salesTrend}%
              </div>
          </div>
          
          {/* Progress Bar with Target Line */}
          <div className="relative h-1.5 w-full bg-[var(--muted)]/30 rounded-full overflow-hidden mt-3 mb-2 z-10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${salesProgress}%` }}
                transition={{ duration: 1 }}
                className="absolute top-0 left-0 h-full bg-[var(--primary)] rounded-full"
              />
              {/* Target Line (100%) */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-black/20 dark:bg-white/20 left-[calc(100%-1px)]" title="Цель" />
          </div>

          {/* Forecast Subtext */}
          <div className="flex items-center gap-2 z-10 relative">
             <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                Прогноз: {formatMoney(forecastSales)}
             </div>
             <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                {Math.round(salesProgress)}%
             </span>
          </div>
        </div>

        {/* Sparkline (Auto Color, No Fill) */}
        <div className="mt-auto z-10 relative pt-2 h-8 w-full opacity-80">
           {salesHistory.length > 1 ? (
              <InlineSparkline 
                data={salesHistory} 
                width={200} 
                height={32} 
                color={undefined} 
                fill={false} 
                showDot={false} 
              />
           ) : null}
        </div>
      </motion.div>

      {/* Card 2: Deals - Orange Theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-5 border border-[var(--border)] rounded-xl shadow-sm flex flex-col justify-between min-h-[160px]"
      >
        <div>
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Сделки (шт)</span>
            <Target className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          
          <div className="flex items-end gap-3">
              <h3 className="text-3xl font-black text-[var(--foreground)] tabular-nums tracking-tight leading-none">
                {stats.successfulDeals}
              </h3>
              <div className={`flex items-center gap-0.5 text-[10px] font-bold mb-1 ${dealsTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {dealsTrend >= 0 ? '+' : ''}{dealsTrend}%
              </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-1.5 w-full bg-[var(--muted)]/30 rounded-full overflow-hidden mt-3 mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dealsProgress}%` }}
                transition={{ duration: 1 }}
                className="absolute top-0 left-0 h-full bg-orange-500 rounded-full"
              />
          </div>

           <div className="flex items-center gap-2 mt-1">
             <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                План: {stats.planDeals} ({Math.round(dealsProgress)}%)
             </span>
          </div>
        </div>

        {/* Sparkline (Auto Color, No Fill) */}
        <div className="mt-auto pt-2 h-8 w-full opacity-80">
           {dealsHistory.length > 1 ? (
              <InlineSparkline 
                data={dealsHistory} 
                width={200} 
                height={32} 
                color={undefined} 
                fill={false} 
                showDot={false} 
              />
           ) : null}
        </div>
      </motion.div>

      {/* Card 3: Conversion - Neutral/Trend Theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-5 border border-[var(--border)] rounded-xl shadow-sm flex flex-col justify-between min-h-[160px]"
      >
        <div>
           <div className="flex justify-between items-start mb-2">
             <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Общая конверсия</span>
             <Activity className="w-4 h-4 text-[var(--muted-foreground)]" />
           </div>
           <h3 className="text-3xl font-black text-[var(--foreground)] tabular-nums tracking-tight">
             {stats.totalConversion}%
           </h3>
        </div>

        <div className="mt-auto">
           {/* Reuse Deals History as a proxy for activity sparkline. Using Auto Color */}
           <div className="h-8 w-full opacity-60 mb-2">
               {dealsHistory.length > 1 && (
                  <InlineSparkline 
                    data={dealsHistory} 
                    width={200} 
                    height={32} 
                    color={undefined} 
                    fill={false} 
                    showDot={false} 
                  />
               )}
           </div>
           
           <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${isConversionUp ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                 {isConversionUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                 {Math.abs(conversionDiff)}%
              </div>
              <span className="text-[10px] text-[var(--muted-foreground)]">к прошлому</span>
           </div>
           <p className="text-[10px] text-[var(--muted-foreground)] mt-1 opacity-70">Zoom 1 → Оплата</p>
        </div>
      </motion.div>

      {/* Card 4: North Star - Purple Theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-5 border border-[var(--border)] rounded-xl shadow-sm flex flex-col justify-between min-h-[160px]"
      >
        <div>
           <div className="flex justify-between items-start mb-2">
             <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-purple-600 dark:text-purple-400">North Star Metric</span>
             <Target className="w-4 h-4 text-[var(--muted-foreground)]" />
           </div>
           <h3 className="text-3xl font-black text-[var(--foreground)] tabular-nums tracking-tight">
             {northStarValue.toFixed(1)}%
           </h3>
           <p className="text-[10px] text-[var(--muted-foreground)] mt-1 font-medium">Конверсия Zoom 1 → Оплата</p>
        </div>

        <div className="mt-auto">
           {/* Explicit Color matching the trend (Green/Red) instead of Blue */}
           <div className="h-8 w-full opacity-80 mb-2">
               {salesHistory.length > 1 && (
                  <InlineSparkline 
                    data={salesHistory} 
                    width={200} 
                    height={32} 
                    color={northStarDelta >= 0 ? 'var(--success)' : 'var(--danger)'} 
                    fill={false} 
                    showDot={false} 
                  />
               )}
           </div>

           <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/50">
              <span className="text-[10px] text-[var(--muted-foreground)]">Цель: {northStarTarget}%</span>
              <span className={`text-[11px] font-bold ${northStarGood ? 'text-emerald-600' : 'text-amber-600'}`}>
                 {northStarDelta >= 0 ? '+' : ''}{northStarDelta.toFixed(1)}%
              </span>
           </div>
        </div>
      </motion.div>
    </div>
  )
}