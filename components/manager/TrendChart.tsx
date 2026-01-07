'use client'

import { memo } from 'react'
import { calcPercent, roundPercent, toDecimal } from '@/lib/utils/decimal'

interface TrendDataPoint {
  date: string
  sales: number
  deals: number
}

interface TrendChartProps {
  data: TrendDataPoint[]
}

export const TrendChart = memo(function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--muted-foreground)]">
        Недостаточно данных для построения графика
      </div>
    )
  }

  const maxSales = Math.max(...data.map(d => d.sales))
  const maxDeals = Math.max(...data.map(d => d.deals))

  return (
    <div className="space-y-6">
      {/* Продажи */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--muted-foreground)] mb-3">Продажи</h4>
        <div className="space-y-2">
          {data.map((point) => {
            const widthPercent = maxSales > 0
              ? Math.min(100, roundPercent(calcPercent(toDecimal(point.sales), toDecimal(maxSales))))
              : 0
            return (
              <div key={point.date} className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted-foreground)] w-20">{point.date}</span>
                <div className="flex-1 h-8 bg-[var(--muted)]/40 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-[var(--primary)] flex items-center justify-end pr-2 text-[var(--primary-foreground)] text-xs font-semibold"
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 15 && `${point.sales.toLocaleString('ru-RU')} ₽`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Сделки */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--muted-foreground)] mb-3">Сделки</h4>
        <div className="space-y-2">
          {data.map((point) => {
            const widthPercent = maxDeals > 0 ? (point.deals / maxDeals) * 100 : 0
            return (
              <div key={point.date} className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted-foreground)] w-20">{point.date}</span>
                <div className="flex-1 h-8 bg-[var(--muted)]/40 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-[var(--success)] flex items-center justify-end pr-2 text-[var(--status-foreground)] text-xs font-semibold"
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 15 && `${point.deals} шт`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
