'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, DollarSign, TrendingUp, Target } from 'lucide-react'
import { FunnelChart } from '@/components/analytics/FunnelChart'
import { RedZoneAlerts } from '@/components/analytics/RedZoneAlerts'
import { formatMoney } from '@/lib/utils/format'
import type { SettingsShape } from '@/lib/settings/getSettings'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { SkeletonChart } from '@/components/ui/SkeletonChart'
import { logError } from '@/lib/logger'

interface EmployeePageProps {
  params: { id: string }
}

interface EmployeeStats {
  successfulDeals: number
  salesAmount: number
  bookedToZoom1: number
  zoom1ToZoom2: number
  zoom2ToContract: number
  contractToPush: number
  pushToDeal: number
  northStar: number
}

interface EmployeeFunnelStage {
  id: string
  stage: string
  value: number
  conversion: number
  benchmark: number
  isRedZone: boolean
}

interface EmployeeRedZoneIssue {
  metric: string
  current: number
}

interface EmployeeStatsResponse {
  employee: { id: string; name: string; role: string }
  stats: EmployeeStats
  funnel: EmployeeFunnelStage[]
  redZones: EmployeeRedZoneIssue[]
  settings?: SettingsShape
}

export default function EmployeePage({ params }: EmployeePageProps) {
  const employeeId = params.id

  const [range, setRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [data, setData] = useState<EmployeeStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const handleRangeClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const value = event.currentTarget.dataset.range as 'week' | 'month' | 'quarter' | 'year' | undefined
    if (!value) return
    setRange(value)
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const res = await fetch(`/api/employees/${employeeId}/stats?range=${range}`)
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'Не удалось загрузить данные сотрудника')
        }
        setData(json)
      } catch (error) {
        logError('Error fetching employee data', error)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [employeeId, range])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-5 w-20 rounded-full bg-[var(--muted)]/40 animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[var(--muted)]/40 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded-full bg-[var(--muted)]/40 animate-pulse" />
              <div className="h-4 w-24 rounded-full bg-[var(--muted)]/30 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
          <SkeletonChart height={320} />
        </div>
      </DashboardLayout>
    )
  }

  if (!data?.stats || !data?.employee) {
    return (
      <DashboardLayout>
        <EmptyState
          title="Данные не найдены"
          description="Проверьте, что сотрудник существует и данные доступны."
          actionLabel="Вернуться назад"
          actionHref="/dashboard"
          icon={<Target className="w-6 h-6" />}
        />
      </DashboardLayout>
    )
  }

  const employee = data.employee
  const stats = data.stats
  const settings: SettingsShape | undefined = data.settings
  const benchmarks = settings?.conversionBenchmarks
  const alertThresholds = settings?.alertThresholds ?? { warning: 0.9, critical: 0.7 }
  const norm = {
    bookedToZoom1: benchmarks?.BOOKED_TO_ZOOM1 ?? 0,
    zoom1ToZoom2: benchmarks?.ZOOM1_TO_ZOOM2 ?? 0,
    zoom2ToContract: benchmarks?.ZOOM2_TO_CONTRACT ?? 0,
    contractToPush: benchmarks?.CONTRACT_TO_PUSH ?? 0,
    pushToDeal: benchmarks?.PUSH_TO_DEAL ?? 0,
  }
  const funnelData = (data.funnel || []).map((stage) => ({
    id: stage.id,
    label: stage.stage,
    value: stage.value,
    conversion: stage.conversion,
    benchmark: stage.benchmark,
    isRedZone: stage.isRedZone,
  }))

  const severity = (value: number, target: number) => {
    if (target === 0) return 'info'
    if (value < target * alertThresholds.critical) return 'critical'
    if (value < target * alertThresholds.warning) return 'warning'
    return 'info'
  }

  const alerts = (data.redZones || []).map((issue, idx: number) => {
    const target =
      issue.metric === 'Запись → 1-й Zoom'
        ? norm.bookedToZoom1
        : issue.metric === '1-й → 2-й Zoom'
        ? norm.zoom1ToZoom2
        : issue.metric === 'Дожим → Оплата'
        ? norm.pushToDeal
        : settings?.northStarTarget ?? 0

    return {
      id: `${issue.metric}-${idx}`,
      type: severity(issue.current, target) as 'critical' | 'warning' | 'info',
      title: issue.metric,
      description: `Текущее значение ${issue.current}% (норма ${target || '—'}%)`,
      managerName: employee.name,
    }
  })

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0]
    }
    return name.charAt(0)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-[var(--primary-foreground)] text-3xl font-semibold shadow-lg">
              {getInitials(employee.name)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">{employee.name}</h1>
              <p className="text-[var(--muted-foreground)]">Личная статистика</p>
            </div>
          </div>

          {/* Period Filter (Visual Only for MVP) */}
          <div className="flex flex-wrap bg-[var(--card)] rounded-lg p-1 border border-[var(--border)]">
            {(['week', 'month', 'quarter'] as const).map((r) => (
              <button
                key={r}
                data-range={r}
                onClick={handleRangeClick}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${range === r
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                  }`}
              >
                {r === 'week' && 'Неделя'}
                {r === 'month' && 'Месяц'}
                {r === 'quarter' && 'Квартал'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Main Stats (2/3) */}
          <div className="lg:col-span-2 space-y-8">

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2 text-[var(--muted-foreground)]">
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-medium">Сделки</span>
                </div>
                <div className="text-3xl font-bold text-[var(--foreground)]">{stats.successfulDeals}</div>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2 text-[var(--muted-foreground)]">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Выручка</span>
                </div>
                <div className="text-3xl font-bold text-[var(--foreground)]">{formatMoney(stats.salesAmount)}</div>
              </div>
            </div>

            {/* Personal Funnel */}
            <div className="glass-card p-8">
              <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Личная воронка</h2>
              <FunnelChart data={funnelData} />
            </div>
          </div>

          {/* Right Column: Analysis (1/3) */}
          <div className="space-y-8">
            {/* Red Zone Alerts */}
            <div className="glass-card p-6 border-l-4 border-l-[var(--danger)]">
              <RedZoneAlerts alerts={alerts} />
              {alerts.length === 0 && (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <div className="w-12 h-12 bg-[var(--success)]/15 text-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="font-medium">Отличная работа!</p>
                  <p className="text-sm">Критических проблем не обнаружено</p>
                </div>
              )}
            </div>

            {/* Conversion Breakdown */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Конверсии</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">Запись → 1-й Zoom</span>
                  <span className={`font-mono font-bold ${stats.bookedToZoom1 < norm.bookedToZoom1 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                    {stats.bookedToZoom1}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">1-й → 2-й Zoom</span>
                  <span className={`font-mono font-bold ${stats.zoom1ToZoom2 < norm.zoom1ToZoom2 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                    {stats.zoom1ToZoom2}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">2-й Zoom → Договор</span>
                  <span className={`font-mono font-bold ${stats.zoom2ToContract < norm.zoom2ToContract ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                    {stats.zoom2ToContract}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">Договор → Дожим</span>
                  <span className={`font-mono font-bold ${stats.contractToPush < norm.contractToPush ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                    {stats.contractToPush}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">Дожим → Оплата</span>
                  <span className={`font-mono font-bold ${stats.pushToDeal < norm.pushToDeal ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                    {stats.pushToDeal}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
