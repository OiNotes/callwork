'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from '@/lib/motion'
import { TrendingDown, AlertCircle, ArrowLeft } from 'lucide-react'
import { EmployeeDrillDown } from '@/components/analytics/EmployeeDrillDown'
import { useRouter } from 'next/navigation'
import { subDays, startOfMonth, endOfMonth } from 'date-fns'
import { PeriodSelector, PeriodPreset } from '@/components/filters/PeriodSelector'
import { logError } from '@/lib/logger'
import dynamic from 'next/dynamic'
import { SkeletonChart } from '@/components/ui/SkeletonChart'

interface FunnelStage {
  stage: string
  count: number
  conversion_rate: number
  is_red_zone: boolean
}

interface EmployeeConversion {
  employee_id: string
  employee_name: string
  stage: string
  count: number
  conversion_rate: number
}

interface FunnelData {
  funnel: FunnelStage[]
  employeeConversions: EmployeeConversion[]
  sideFlow?: {
    refusals: {
      total: number
      rateFromFirstZoom: number
      byStage: Array<{ stageId: string; label: string; count: number; rate: number }>
    }
    warming: { count: number }
  }
  northStarKpi?: {
    value: number
    target: number
    delta: number
    isOnTrack: boolean
  }
}

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  }
}

const InteractiveFunnelChart = dynamic(
  () =>
    import('@/components/analytics/InteractiveFunnelChart').then((mod) => ({
      default: mod.InteractiveFunnelChart,
    })),
  {
    loading: () => <SkeletonChart />,
    ssr: false,
  }
)

export default function FunnelPage() {
  const router = useRouter()
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null)
  const [datePreset, setDatePreset] = useState<PeriodPreset>('thisMonth')
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  })
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [selectedManager, setSelectedManager] = useState<string>('all')

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const fetchFunnelData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString()
      })
      if (selectedManager !== 'all') {
        params.set('userId', selectedManager)
      }

      const res = await fetch(`/api/analytics/funnel?${params}`)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Не удалось загрузить данные воронки')
      }

      const json = await res.json()
      setData(json)

      const uniqueManagers = Array.from(
        new Map(
          (json.employeeConversions || []).map((emp: EmployeeConversion) => [emp.employee_id, emp.employee_name])
        ).entries()
      ).map(([id, name]) => ({ id: id as string, name: name as string }))
      setManagers(uniqueManagers)
    } catch (err) {
      logError('Failed to fetch funnel', err)
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }, [dateRange.start, dateRange.end, selectedManager])

  useEffect(() => {
    fetchFunnelData()
  }, [fetchFunnelData])

  const updateDatePreset = (preset: PeriodPreset, nextRange?: { start: Date; end: Date }) => {
    setDatePreset(preset)
    if (nextRange) {
      setDateRange(nextRange)
      return
    }

    const now = new Date()
    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      setDateRange({ start, end })
    } else if (preset === 'week') {
      setDateRange({ start: subDays(now, 7), end: now })
    } else if (preset === 'lastMonth') {
      setDateRange({ start: startOfMonth(subDays(startOfMonth(now), 1)), end: endOfMonth(subDays(startOfMonth(now), 1)) })
    } else {
      setDateRange({ start: startOfMonth(now), end: endOfMonth(now) })
    }
  }

  const handlePresetChange = useCallback((preset: PeriodPreset, nextRange?: { start: Date; end: Date }) => {
    updateDatePreset(preset, nextRange)
  }, [updateDatePreset])


  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--background)] to-[var(--secondary)] p-8"
    >
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[var(--primary)] hover:text-[var(--primary-hover)] mb-4 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Назад</span>
        </button>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown className="w-8 h-8 text-[var(--primary)]" />
                  <h1 className="text-4xl font-bold text-[var(--foreground)]">
                    Рентген воронки продаж
                  </h1>
                </div>
                <p className="text-[var(--muted-foreground)]">
                  Анализ конверсий на каждом этапе продаж с детализацией по сотрудникам
                </p>
            </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <PeriodSelector
              selectedPreset={datePreset}
              range={dateRange}
              onPresetChange={handlePresetChange}
              title="Период"
            />

            <div className="bg-[var(--card)] rounded-2xl p-4 shadow-[var(--shadow-sm)] border border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)] mb-2">Менеджер</p>
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="all">Вся команда</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-[var(--card)] rounded-2xl shadow-lg border border-[var(--border)] p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]"
              />
            </div>
            <p className="text-lg font-medium text-[var(--muted-foreground)]">
              Загрузка данных воронки...
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-2xl p-8 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--danger)]/15 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-[var(--danger)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                Ошибка загрузки данных
              </h2>
              <p className="text-[var(--muted-foreground)] mb-4">{error}</p>
              <button
                onClick={fetchFunnelData}
                className="px-6 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors duration-200"
              >
                Повторить попытку
              </button>
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          {data.funnel.length === 0 ? (
            <div className="bg-[var(--card)] rounded-2xl shadow-lg border border-[var(--border)] p-12 text-center">
              <TrendingDown className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                Нет данных за выбранный период
              </h3>
              <p className="text-[var(--muted-foreground)]">
                Попробуйте выбрать другой период или убедитесь, что есть активность
              </p>
            </div>
          ) : (
            <>
              <InteractiveFunnelChart
                funnel={data.funnel}
                onStageClick={setSelectedStage}
              />

              {selectedStage && (
                <EmployeeDrillDown
                  stage={selectedStage}
                  employees={
                    selectedManager === 'all'
                      ? data.employeeConversions
                      : data.employeeConversions.filter((e) => e.employee_id === selectedManager)
                  }
                  onClose={() => setSelectedStage(null)}
                />
              )}
            </>
          )}
        </>
      ) : null}

      {!loading && !error && data?.sideFlow && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-[var(--card)] rounded-2xl shadow-md border border-[var(--border)] p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Отказы по этапам</h3>
            <div className="space-y-2">
              {data.sideFlow.refusals.byStage.map((item) => (
                <div key={item.stageId} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--foreground)]">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--muted-foreground)]">{item.count}</span>
                    <span className={`font-semibold ${item.rate > 20 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                      {item.rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[var(--card)] rounded-2xl shadow-md border border-[var(--border)] p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Главный KPI</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">1-й Zoom → Оплата</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-[var(--foreground)]">{data.northStarKpi?.value.toFixed(1)}%</p>
                <p className="text-xs text-[var(--muted-foreground)]">Цель: {data.northStarKpi?.target}%</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  data.northStarKpi?.isOnTrack ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--warning)]/10 text-[var(--warning)]'
                }`}
              >
                {data.northStarKpi?.isOnTrack ? 'В норме' : 'Ниже цели'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {!loading && !error && data && data.funnel.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-[var(--secondary)]/70 border border-[var(--border)] rounded-2xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)]/15 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                Как пользоваться анализом воронки
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary)] font-bold">•</span>
                  <span>
                    <strong className="text-[var(--foreground)]">Нажмите на этап</strong> воронки для просмотра детализации по сотрудникам
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--danger)] font-bold">•</span>
                  <span>
                    <strong className="text-[var(--foreground)]">Красные зоны</strong> — этапы с низкой конверсией, требующие внимания
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--success)] font-bold">•</span>
                  <span>
                    <strong className="text-[var(--foreground)]">Зелёные зоны</strong> — этапы с хорошей конверсией (&gt;70%)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary)] font-bold">•</span>
                  <span>
                    Используйте фильтры <strong className="text-[var(--foreground)]">TOP-3</strong> и{' '}
                    <strong className="text-[var(--foreground)]">BOTTOM-3</strong> для быстрого анализа производительности
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
