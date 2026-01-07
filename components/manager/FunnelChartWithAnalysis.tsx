'use client'

import { memo } from 'react'
import { TrendingDown, BarChart2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface FunnelData {
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  pushCount: number
  successfulDeals: number
}

interface FunnelChartProps {
  data: FunnelData
}

export const FunnelChartWithAnalysis = memo(function FunnelChartWithAnalysis({ data }: FunnelChartProps) {
  const hasData = Object.values(data).some((value) => value > 0)
  if (!hasData) {
    return (
      <EmptyState
        icon={<BarChart2 className="w-6 h-6" />}
        title="Нет данных"
        description="Данные появятся после создания отчётов"
      />
    )
  }

  const stages = [
    { label: 'Записаны на Zoom', value: data.zoomBooked, color: 'bg-[var(--primary)]', textColor: 'text-[var(--primary-foreground)]' },
    { label: '1-й Zoom проведён', value: data.zoom1Held, color: 'bg-[var(--primary-hover)]', textColor: 'text-[var(--primary-foreground)]' },
    { label: '2-й Zoom проведён', value: data.zoom2Held, color: 'bg-[var(--info)]', textColor: 'text-[var(--status-foreground)]' },
    { label: 'Разбор договора', value: data.contractReview, color: 'bg-[var(--accent)]', textColor: 'text-[var(--foreground)]' },
    { label: 'Дожим', value: data.pushCount, color: 'bg-[var(--warning)]', textColor: 'text-[var(--status-foreground)]' },
    { label: 'Оплаты', value: data.successfulDeals, color: 'bg-[var(--success)]', textColor: 'text-[var(--status-foreground)]' },
  ]

  const maxValue = data.zoomBooked || 1

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const widthPercent = (stage.value / maxValue) * 100
        const prevValue = index > 0 ? stages[index - 1].value : stage.value
        const conversionRate = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : 100
        const isLowConversion = conversionRate < 70 && index > 0

        return (
          <div key={stage.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--foreground)]">{stage.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--foreground)]">{stage.value}</span>
                {index > 0 && (
                  <span className={`text-xs ${isLowConversion ? 'text-[var(--danger)]' : 'text-[var(--muted-foreground)]'}`}>
                    ({conversionRate}%)
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="h-12 bg-[var(--muted)]/40 rounded-lg overflow-hidden">
                <div 
                  className={`h-full ${stage.color} ${stage.textColor} transition-all duration-500 flex items-center justify-end pr-3 font-semibold text-sm`}
                  style={{ width: `${widthPercent}%` }}
                >
                  {widthPercent > 10 && stage.value}
                </div>
              </div>
              {isLowConversion && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                  <TrendingDown className="w-5 h-5 text-[var(--danger)]" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
})
