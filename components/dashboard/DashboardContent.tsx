'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from '@/lib/motion'
import { PulseGrid } from '@/components/dashboard/PulseGrid'
import { FunnelChart } from '@/components/analytics/FunnelChart'
import { ManagersTable } from '@/components/analytics/ManagersTable'
import { RedZoneAlerts } from '@/components/analytics/RedZoneAlerts'
import { DealsList } from '@/components/deals/DealsList'
import { PeriodSelector } from '@/components/filters/PeriodSelector'
import { ManagerSelector } from '@/components/filters/ManagerSelector'
import { RightPanelControls } from '@/components/dashboard/RightPanelControls'
import { useDashboardData, type DashboardEmployee } from '@/hooks/useDashboardData'
import type { DashboardContentProps, DateRange } from '@/components/dashboard/types'
import type { PeriodPreset } from '@/components/filters/PeriodSelector'
import type { DealCard } from '@/components/deals/DealsList'
import dynamic from 'next/dynamic'
import { SkeletonChart } from '@/components/ui/SkeletonChart'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { SkeletonTable } from '@/components/ui/SkeletonTable'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

const PerformanceTrendChart = dynamic(
  () =>
    import('@/components/charts/PerformanceTrendChart').then((mod) => ({
      default: mod.PerformanceTrendChart,
    })),
  {
    loading: () => <SkeletonChart height={240} />,
    ssr: false,
  }
)

const ConversionPieChart = dynamic(
  () =>
    import('@/components/charts/ConversionPieChart').then((mod) => ({
      default: mod.ConversionPieChart,
    })),
  {
    loading: () => <SkeletonChart height={200} />,
    ssr: false,
  }
)

const EmployeeComparisonChart = dynamic(
  () =>
    import('@/components/charts/EmployeeComparisonChart').then((mod) => ({
      default: mod.EmployeeComparisonChart,
    })),
  {
    loading: () => <SkeletonChart height={300} />,
    ssr: false,
  }
)

const TeamSalesChart = dynamic(
  () =>
    import('@/components/charts/TeamSalesChart').then((mod) => ({
      default: mod.TeamSalesChart,
    })),
  {
    loading: () => <SkeletonChart height={250} />,
    ssr: false,
  }
)

const WeeklyActivityChart = dynamic(
  () =>
    import('@/components/charts/WeeklyActivityChart').then((mod) => ({
      default: mod.WeeklyActivityChart,
    })),
  {
    loading: () => <SkeletonChart height={200} />,
    ssr: false,
  }
)

export function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter()
  const headerRef = useRef<HTMLDivElement>(null)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const isManager = user.role === 'MANAGER' || user.role === 'ADMIN'

  const [selectedManagerId, setSelectedManagerId] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<PeriodPreset>('thisMonth')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  })
  const [page, setPage] = useState(1)
  const [employees, setEmployees] = useState<DashboardEmployee[]>([])
  const [managerOptions, setManagerOptions] = useState<DashboardEmployee[]>([])
  const [deals, setDeals] = useState<DealCard[]>([])
  const [dealsError, setDealsError] = useState<string | null>(null)

  const filters = useMemo(
    () => ({
      managerId: selectedManagerId === 'all' ? undefined : selectedManagerId,
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      page,
      limit: 50,
    }),
    [selectedManagerId, dateRange.start, dateRange.end, page]
  )

  const { data, isLoading, isFetching, isError, error, refetch } = useDashboardData(filters, { enabled: isManager })

  const handleDatePresetChange = useCallback((preset: PeriodPreset, nextRange?: DateRange) => {
    setDatePreset(preset)
    if (nextRange) {
      setDateRange(nextRange)
    }
  }, [])

  useEffect(() => {
    setPage(1)
  }, [selectedManagerId, dateRange.start, dateRange.end])

  useEffect(() => {
    if (!data?.employees) return
    setEmployees((prev) => (page === 1 ? data.employees : [...prev, ...data.employees]))
    if (selectedManagerId === 'all') {
      setManagerOptions((prev) => (page === 1 ? data.employees : [...prev, ...data.employees]))
    }
  }, [data?.employees, page, selectedManagerId])

  useEffect(() => {
    if (data?.deals) {
      setDeals(data.deals)
    }
  }, [data?.deals])

  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderVisible(window.scrollY < 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleReportClick = useCallback(() => {
    router.push('/dashboard/report')
  }, [router])

  const errorMessage =
    isError && error instanceof Error ? error.message : isError ? 'Ошибка загрузки данных' : null
  const pulseError = errorMessage
  const handlePulseRetry = useCallback(() => {
    refetch()
  }, [refetch])

  const managerList = managerOptions.length > 0 ? managerOptions : employees
  const teamStats = data?.teamStats ?? null
  const teamFunnel = data?.teamFunnel ?? []
  const trendData = data?.trendData ?? []
  const weeklyActivityData = data?.weeklyActivityData ?? []
  const redZoneAlerts = data?.redZoneAlerts ?? []
  const motivationData = data?.motivationData ?? null
  const northStarKpi = data?.northStarKpi ?? null
  const employeesPagination = data?.pagination ?? null
  const employeesLoading = isFetching
  const dealsLoading = isFetching && deals.length === 0

  const conversionPieData = useMemo(
    () => teamFunnel.map((stage) => ({ name: stage.label, value: stage.value })),
    [teamFunnel]
  )

  const employeeComparisonData = useMemo(() => {
    if (employees.length === 0) return []
    const sorted = [...employees].sort(
      (a, b) => b.metrics.monthlySalesAmount - a.metrics.monthlySalesAmount
    )
    return sorted.slice(0, 5).map((employee) => ({
      name: employee.name.split(' ')[0] || employee.name,
      deals: employee.metrics.successfulDeals,
      sales: employee.metrics.monthlySalesAmount,
    }))
  }, [employees])

  const loadMoreEmployees = useCallback(() => {
    if (!employeesPagination?.hasMore || employeesLoading) return
    setPage((prev) => prev + 1)
  }, [employeesPagination?.hasMore, employeesLoading])

  const handleToggleFocus = useCallback(async (dealId: string, nextValue: boolean) => {
    setDealsError(null)
    setDeals((prev) =>
      prev.map((deal) => (deal.id === dealId ? { ...deal, isFocus: nextValue } : deal))
    )

    try {
      const response = await fetch(`/api/deals/${dealId}/focus`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFocus: nextValue }),
      })

      if (!response.ok) {
        throw new Error('Не удалось обновить фокус')
      }

      refetch()
    } catch (error) {
      setDeals((prev) =>
        prev.map((deal) => (deal.id === dealId ? { ...deal, isFocus: !nextValue } : deal))
      )
      setDealsError(error instanceof Error ? error.message : 'Ошибка обновления сделки')
    }
  }, [refetch])

  const fallbackTeamStats = {
    zoomBooked: 0,
    zoom1Held: 0,
    zoom2Held: 0,
    contractReview: 0,
    pushCount: 0,
    successfulDeals: 0,
    salesAmount: 0,
    planSales: 0,
    planDeals: 0,
    refusals: 0,
    warming: 0,
    bookedToZoom1: 0,
    zoom1ToZoom2: 0,
    zoom2ToContract: 0,
    contractToPush: 0,
    pushToDeal: 0,
    northStar: 0,
    totalConversion: 0,
    activityScore: 0,
    trend: 'flat' as const,
  }

  if (isLoading) {
    return (
      <div className="space-y-8 pb-96">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} lines={3} className="min-h-[160px]" />
          ))}
        </div>
        <SkeletonCard lines={3} className="min-h-[120px]" />
        <SkeletonChart height={240} />
        <SkeletonTable rows={6} columns={4} />
        <SkeletonTable rows={4} columns={3} />
        <SkeletonChart height={300} />
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">Заполните дневной отчёт</h2>
        <p className="text-[var(--muted-foreground)] mb-4">
          Для сотрудников доступен личный кабинет отчётов. Данные автоматически попадут в аналитику.
        </p>
        <button
          onClick={handleReportClick}
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] transition-colors"
        >
          Открыть форму отчёта
        </button>
      </div>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-96"
    >
      {/* Top Controls Header */}
      <motion.div
        layout
        ref={headerRef}
        animate={{
          opacity: isHeaderVisible ? 1 : 0,
          y: isHeaderVisible ? 0 : -20,
          pointerEvents: isHeaderVisible ? 'auto' : 'none'
        }}
        transition={{ duration: 0.3 }}
        className="relative z-30 bg-[var(--background)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/75 py-4 border-b border-[var(--border)] -mx-4 px-4 sm:-mx-8 sm:px-8 mb-8 transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Центр управления</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="w-full sm:w-auto">
              <ManagerSelector
                managers={managerList}
                selectedManagerId={selectedManagerId}
                onSelectManager={setSelectedManagerId}
                title="Сотрудник"
              />
            </div>
            <div className="w-full sm:w-auto">
              <PeriodSelector
                selectedPreset={datePreset}
                range={dateRange}
                onPresetChange={handleDatePresetChange}
                title="Период"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Header */}
      <div className="space-y-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
            Центр управления продажами
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Оперативный контроль и аналитика
          </p>
        </div>
      </div>

      {/* L1: Pulse Grid (Plan/Fact + KPI + Forecast) */}
      {teamStats || pulseError ? (
        <PulseGrid
          stats={{
            ...(teamStats ?? fallbackTeamStats),
            prevConversion: (teamStats ?? fallbackTeamStats).totalConversion,
          }}
          northStarKpi={northStarKpi}
          trendData={trendData}
          forecastSales={motivationData?.totalPotentialTurnover ?? 0}
          errorMessage={pulseError}
          onRetry={pulseError ? handlePulseRetry : undefined}
        />
      ) : employeesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} lines={3} className="min-h-[160px]" />
          ))}
        </div>
      ) : null}

      {/* L2: Management by Exception (Alerts) */}
      <AnimatePresence mode="popLayout">
        {redZoneAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            layout
          >
            <RedZoneAlerts alerts={redZoneAlerts} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* L4: Team Funnel */}
      <motion.div variants={item} className="glass-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Воронка отдела</h2>
        {employeesLoading && teamFunnel.length === 0 ? (
          <SkeletonChart height={200} className="border-0 bg-transparent p-0" />
        ) : (
          <FunnelChart
            data={teamFunnel}
            error={errorMessage}
            onRetry={errorMessage ? handlePulseRetry : undefined}
          />
        )}
      </motion.div>

      {/* L5: Managers Table */}
      <motion.div variants={item} className="glass-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Эффективность менеджеров</h2>
        {employeesLoading && employees.length === 0 ? (
          <SkeletonTable rows={6} columns={4} className="border-0 bg-transparent" />
        ) : (
          <ManagersTable
            employees={employees}
            selectedId={selectedManagerId === 'all' ? undefined : selectedManagerId}
            onSelectEmployee={setSelectedManagerId}
            benchmarks={data?.settings?.conversionBenchmarks}
            error={errorMessage}
            onRetry={errorMessage ? handlePulseRetry : undefined}
          />
        )}
        {selectedManagerId === 'all' && employeesPagination && employeesPagination.total > employees.length && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--muted-foreground)]">
            <span>
              Показано {employees.length} из {employeesPagination.total} сотрудников
            </span>
            <button
              type="button"
              onClick={loadMoreEmployees}
              disabled={!employeesPagination.hasMore || employeesLoading}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {employeesLoading ? 'Загрузка...' : employeesPagination.hasMore ? 'Показать ещё' : 'Все сотрудники загружены'}
            </button>
          </div>
        )}
      </motion.div>

      {/* L6: Conversion + Comparison */}
      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Конверсия по этапам</h2>
          {employeesLoading && conversionPieData.length === 0 ? (
            <SkeletonChart height={220} className="border-0 bg-transparent p-0" />
          ) : (
            <div className="h-[240px]">
              <ConversionPieChart data={conversionPieData} />
            </div>
          )}
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Сравнение менеджеров</h2>
          {employeesLoading && employeeComparisonData.length === 0 ? (
            <SkeletonChart height={260} className="border-0 bg-transparent p-0" />
          ) : (
            <div className="h-[300px]">
              <EmployeeComparisonChart data={employeeComparisonData} />
            </div>
          )}
        </div>
      </motion.div>

      {/* L7: Team Sales + Weekly Activity */}
      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Продажи команды</h2>
          {employeesLoading && trendData.length === 0 ? (
            <SkeletonChart height={240} className="border-0 bg-transparent p-0" />
          ) : (
            <div className="h-[260px]">
              <TeamSalesChart data={trendData} />
            </div>
          )}
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Активность за неделю</h2>
          {employeesLoading && weeklyActivityData.length === 0 ? (
            <SkeletonChart height={220} className="border-0 bg-transparent p-0" />
          ) : (
            <div className="h-[240px]">
              <WeeklyActivityChart data={weeklyActivityData} />
            </div>
          )}
        </div>
      </motion.div>

      {/* L8: Focus Deals */}
      <motion.div variants={item}>
        <DealsList
          deals={deals}
          loading={dealsLoading}
          error={dealsError ?? errorMessage}
          onToggleFocus={handleToggleFocus}
        />
      </motion.div>

      {/* L9: Trend Chart */}
      <AnimatePresence mode="popLayout">
        {trendData.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            layout
            className="glass-card p-8"
          >
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Динамика показателей</h2>
            <PerformanceTrendChart data={trendData} className="h-[300px]" />
          </motion.div>
        ) : employeesLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            layout
            className="glass-card p-8"
          >
            <SkeletonChart height={300} className="border-0 bg-transparent p-0" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Side Controls */}
      <RightPanelControls
        isVisible={!isHeaderVisible}
        selectedPreset={datePreset}
        range={dateRange}
        onPresetChange={handleDatePresetChange}
        managers={managerList}
        selectedManagerId={selectedManagerId}
        onSelectManager={setSelectedManagerId}
      />
    </motion.div>
  )
}
