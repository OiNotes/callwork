'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PulseGrid } from '@/components/dashboard/PulseGrid'
import { FunnelChart } from '@/components/analytics/FunnelChart'
import { ManagersTable } from '@/components/analytics/ManagersTable'
import { RedZoneAlerts } from '@/components/analytics/RedZoneAlerts'
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrendChart'
import { DealsList } from '@/components/deals/DealsList'
import { PeriodSelector } from '@/components/filters/PeriodSelector'
import { ManagerSelector } from '@/components/filters/ManagerSelector'
import { RightPanelControls } from '@/components/dashboard/RightPanelControls'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { DashboardContentProps } from '@/components/dashboard/types'

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

export function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter()
  const headerRef = useRef<HTMLDivElement>(null)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)

  const {
    isInitialLoading,
    motivationLoading,
    dealsLoading,
    managerStats,
    teamFunnel,
    trendData,
    alerts,
    teamStats,
    northStarKpi,
    rawEmployees,
    motivationData,
    deals,
    settings,
    managerSparklines,
    motivationError,
    dealsError,
    selectedManagerId,
    datePreset,
    dateRange,
    setSelectedManagerId,
    handleDatePresetChange,
    handleToggleFocus,
    refreshMotivation,
  } = useDashboardData({ user })

  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderVisible(window.scrollY < 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const selectedManager = selectedManagerId !== 'all'
    ? rawEmployees.find((emp) => emp.id === selectedManagerId)
    : null

  const motivationTitle =
    selectedManagerId === 'all'
      ? 'Доход команды (Прогноз)'
      : selectedManager
        ? `Доход менеджера ${selectedManager.name}`
        : 'Мой доход (Прогноз)'

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    )
  }

  if (user.role !== 'MANAGER') {
    return (
      <div className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">Заполните дневной отчёт</h2>
        <p className="text-[var(--muted-foreground)] mb-4">
          Для сотрудников доступен личный кабинет отчётов. Данные автоматически попадут в аналитику.
        </p>
        <button
          onClick={() => router.push('/dashboard/report')}
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors"
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
                managers={rawEmployees}
                selectedManagerId={selectedManagerId}
                onSelectManager={setSelectedManagerId}
                title="Сотрудник"
              />
            </div>
            <div className="w-full sm:w-auto">
              <PeriodSelector
                selectedPreset={datePreset}
                range={dateRange}
                onPresetChange={(preset, next) => handleDatePresetChange(preset, next)}
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
      {teamStats && (
        <PulseGrid
          stats={{
            ...teamStats,
            prevConversion: teamStats.totalConversion,
          }}
          northStarKpi={northStarKpi}
          trendData={trendData}
          forecastSales={motivationData?.totalPotentialTurnover ?? 0}
        />
      )}

      {/* L2: Management by Exception (Alerts) */}
      <AnimatePresence mode="popLayout">
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            layout
          >
            <RedZoneAlerts alerts={alerts} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* L4: Team Funnel */}
      <motion.div variants={item} className="glass-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Воронка отдела</h2>
        <FunnelChart data={teamFunnel} />
      </motion.div>

      {/* L5: Managers Table */}
      <motion.div variants={item} className="glass-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Эффективность менеджеров</h2>
        <ManagersTable
          managers={managerStats}
          benchmarks={settings?.conversionBenchmarks}
          activityTarget={settings?.activityTarget}
          sparklines={managerSparklines}
        />
      </motion.div>

      {/* L6: Focus Deals */}
      <motion.div variants={item}>
        <DealsList
          deals={deals}
          loading={dealsLoading}
          error={dealsError}
          onToggleFocus={handleToggleFocus}
        />
      </motion.div>

      {/* L7: Trend Chart */}
      <AnimatePresence mode="popLayout">
        {trendData.length > 0 && (
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
        )}
      </AnimatePresence>

      {/* Side Controls */}
      <RightPanelControls
        isVisible={!isHeaderVisible}
        selectedPreset={datePreset}
        range={dateRange}
        onPresetChange={(preset, next) => handleDatePresetChange(preset, next)}
        managers={rawEmployees}
        selectedManagerId={selectedManagerId}
        onSelectManager={setSelectedManagerId}
      />
    </motion.div>
  )
}
