'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { logError } from '@/lib/logger'
import dynamic from 'next/dynamic'
import { SkeletonChart } from '@/components/ui/SkeletonChart'

interface ForecastMetrics {
  current: number
  goal: number
  projected: number
  completion: number
  pacing: number
  isPacingGood: boolean
  daysInMonth: number
  daysPassed: number
  daysRemaining: number
  dailyAverage: number
  dailyRequired: number
  expectedByNow: number
}

interface ForecastPoint {
  day: number
  plan?: number
  actual?: number
  forecast?: number
}

interface DepartmentForecastData {
  metrics: ForecastMetrics
  chartData: ForecastPoint[]
  teamSize: number
}

const ForecastChart = dynamic(
  () =>
    import('@/components/analytics/ForecastChart').then((mod) => ({
      default: mod.ForecastChart,
    })),
  {
    loading: () => <SkeletonChart />,
    ssr: false,
  }
)

export default function DepartmentForecastPage() {
  const [data, setData] = useState<DepartmentForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/forecast/department')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (e) {
        logError('Failed to fetch department forecast', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (!loading && !data) {
    return (
      <EmptyState
        title="Нет данных"
        description="Не удалось загрузить прогноз отдела. Попробуйте позже."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         {data ? (
           <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] bg-[var(--card)] px-3 py-1.5 rounded-full border border-[var(--border)] shadow-sm w-fit">
              <Users className="w-4 h-4" />
              <span>Размер команды: <b>{data.teamSize}</b></span>
           </div>
         ) : (
           <div className="h-8 w-40 rounded-full bg-[var(--muted)]/40 animate-pulse" />
         )}
      </div>

      <ForecastChart
        loading={loading}
        data={data ? {
          forecast: data.metrics,
          chartData: data.chartData
        } : undefined}
        userName="Отдел продаж"
      />
    </div>
  )
}
