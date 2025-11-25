'use client'

import { useMemo } from 'react'
import { ManagerStats } from '@/lib/analytics/funnel.client'
import { formatMoney } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { CONVERSION_BENCHMARKS } from '@/lib/config/metrics'
import type { ConversionBenchmarkConfig } from '@/lib/calculations/metrics'
import { InlineSparkline } from '@/components/charts/InlineSparkline'

interface ManagersTableProps {
  managers: ManagerStats[]
  benchmarks?: Partial<ConversionBenchmarkConfig>
  activityTarget?: number
  /** Map of managerId -> sales history for sparklines */
  sparklines?: Map<string, number[]>
}

export function ManagersTable({ managers, benchmarks, sparklines }: ManagersTableProps) {
  const sorted = [...managers].sort((a, b) => b.salesAmount - a.salesAmount)

  const mergedBenchmarks: ConversionBenchmarkConfig = {
    ...CONVERSION_BENCHMARKS,
    ...(benchmarks ?? {}),
  }

  const maxRevenue = useMemo(() => {
    return Math.max(...managers.map((m) => m.salesAmount), 1)
  }, [managers])

  /**
   * Very Soft (Pastel) Heatmap Colors
   */
  const getCellClass = (val: number, benchmark: number) => {
    const ratio = val / (benchmark || 1)

    if (ratio >= 1.1) {
      // Pastel Green
      return 'bg-[#F0FDF4] dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 font-medium'
    }
    if (ratio >= 0.9) {
      // Neutral
      return 'text-[var(--muted-foreground)]'
    }
    if (ratio >= 0.7) {
      // Pastel Amber
      return 'bg-[#FFFBEB] dark:bg-amber-900/10 text-amber-700 dark:text-amber-500'
    }
    // Pastel Red
    return 'bg-[#FEF2F2] dark:bg-red-900/10 text-red-700 dark:text-red-400 font-medium'
  }

  const getRevenueColor = (salesAmount: number, planSales: number) => {
    if (planSales <= 0) return 'var(--muted-foreground)'
    const ratio = salesAmount / planSales
    if (ratio >= 0.8) return 'var(--primary)' // Blue for on track
    if (ratio >= 0.5) return '#F59E0B' // Amber
    return '#EF4444' // Red
  }

  if (managers.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]">
        <p>Нет данных по менеджерам</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)] text-xs uppercase tracking-wider">
            <th className="px-4 py-4 text-left font-medium w-12">#</th>
            <th className="px-4 py-4 text-left font-medium min-w-[160px]">Менеджер</th>
            <th className="px-4 py-4 text-right font-medium min-w-[180px]">Выручка (KPI)</th>
            <th className="px-4 py-4 text-right font-medium w-24">Сделки</th>
            {sparklines && <th className="px-4 py-4 text-right font-medium w-24">Тренд</th>}
            <th className="px-2 py-4 text-right font-medium w-24">Конв.<br/>Запись</th>
            <th className="px-2 py-4 text-right font-medium w-24">Конв.<br/>Zoom 1</th>
            <th className="px-2 py-4 text-right font-medium w-24">Конв.<br/>Zoom 2</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {sorted.map((m, idx) => {
            const rank = idx + 1
            const managerSparkline = sparklines?.get(m.id) || []
            const planPercent = m.planSales > 0 ? Math.round((m.salesAmount / m.planSales) * 100) : 0
            const revenueColor = getRevenueColor(m.salesAmount, m.planSales)

            return (
              <tr key={m.id} className="group hover:bg-[var(--muted)]/30 transition-colors">
                {/* Rank */}
                <td className="px-4 py-6 text-center text-[var(--muted-foreground)]">
                   {rank}
                </td>

                {/* Name */}
                <td className="px-4 py-6 font-medium text-[var(--foreground)]">
                  {m.name}
                </td>

                {/* Revenue with Integrated Data Bar */}
                <td className="px-4 py-6 text-right">
                   <div className="flex flex-col items-end justify-center gap-1.5">
                      <span className="font-bold tabular-nums text-[var(--foreground)]">
                         {formatMoney(m.salesAmount)}
                      </span>
                      
                      {/* Custom Data Bar inside cell */}
                      <div className="w-full max-w-[120px] h-1.5 bg-[var(--muted)]/30 rounded-full overflow-hidden flex justify-end ml-auto relative">
                         {/* Fill */}
                         <div 
                            className="absolute right-0 top-0 bottom-0 rounded-full"
                            style={{ 
                               width: `${Math.min((m.salesAmount / maxRevenue) * 100, 100)}%`,
                               backgroundColor: revenueColor
                            }}
                         />
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                         {planPercent}% плана
                      </div>
                   </div>
                </td>

                {/* Deals (FIXED: No red color, aligned right) */}
                <td className="px-4 py-6 text-right font-semibold tabular-nums text-[var(--foreground)]">
                  {m.successfulDeals}
                </td>

                {/* Sparkline (FIXED: No fill, Auto color) */}
                {sparklines && (
                  <td className="px-4 py-6 text-right">
                    <div className="flex justify-end">
                       <InlineSparkline
                         data={managerSparkline}
                         width={60}
                         height={24}
                         color={undefined} // Use auto trend color
                         showDot={false}
                         fill={false}
                       />
                    </div>
                  </td>
                )}

                {/* Conversion Heatmap (FIXED: Aligned Right, Pastel Colors) */}
                <td className={cn('px-2 py-6 text-right tabular-nums text-xs border-l border-dashed border-[var(--border)]/50', getCellClass(m.bookedToZoom1, mergedBenchmarks.BOOKED_TO_ZOOM1))}>
                  {m.bookedToZoom1}%
                </td>
                <td className={cn('px-2 py-6 text-right tabular-nums text-xs border-l border-dashed border-[var(--border)]/50', getCellClass(m.zoom1ToZoom2, mergedBenchmarks.ZOOM1_TO_ZOOM2))}>
                  {m.zoom1ToZoom2}%
                </td>
                <td className={cn('px-2 py-6 text-right tabular-nums text-xs border-l border-dashed border-[var(--border)]/50', getCellClass(m.zoom2ToContract, mergedBenchmarks.ZOOM2_TO_CONTRACT))}>
                  {m.zoom2ToContract}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}