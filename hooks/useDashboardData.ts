'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  DashboardUser,
  EmployeeData,
  TeamStats,
  TrendDataPoint,
  DashboardAlert,
  DateRange,
  EmployeeReport,
} from '@/components/dashboard/types'
import type { MotivationCalculationResult } from '@/lib/motivation/motivationCalculator'
import type { MotivationGradeConfig } from '@/lib/config/motivationGrades'
import type { NorthStarKpi } from '@/lib/calculations/funnel'
import type { SettingsShape } from '@/lib/settings/getSettings'
import type { DealCard } from '@/components/deals/DealsList'
import type { PeriodPreset } from '@/components/filters/PeriodSelector'
import { type ManagerStats, type FunnelStage, getFunnelData, analyzeRedZonesWithBenchmarks } from '@/lib/analytics/funnel.client'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { buildManagerSparklines } from '@/lib/utils/chartData'

interface UseDashboardDataProps {
  user: DashboardUser
}

interface UseDashboardDataReturn {
  // Loading states
  isInitialLoading: boolean
  motivationLoading: boolean
  dealsLoading: boolean

  // Data
  managerStats: ManagerStats[]
  teamFunnel: FunnelStage[]
  trendData: TrendDataPoint[]
  alerts: DashboardAlert[]
  teamStats: TeamStats | null
  northStarKpi: NorthStarKpi | null
  rawEmployees: EmployeeData[]
  motivationData: MotivationCalculationResult | null
  motivationGrades: MotivationGradeConfig[]
  deals: DealCard[]
  settings: SettingsShape | null
  managerSparklines: Map<string, number[]>

  // Errors
  motivationError: string | null
  dealsError: string | null

  // Filters
  selectedManagerId: string
  datePreset: PeriodPreset
  dateRange: DateRange

  // Actions
  setSelectedManagerId: (id: string) => void
  handleDatePresetChange: (preset: PeriodPreset, range?: DateRange) => void
  handleToggleFocus: (dealId: string, nextValue: boolean) => Promise<void>
  refreshMotivation: () => void
}

const safeDiv = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0)

export function useDashboardData({ user }: UseDashboardDataProps): UseDashboardDataReturn {
  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [motivationLoading, setMotivationLoading] = useState(false)
  const [dealsLoading, setDealsLoading] = useState(false)

  // Data states
  const [managerStats, setManagerStats] = useState<ManagerStats[]>([])
  const [teamFunnel, setTeamFunnel] = useState<FunnelStage[]>([])
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [northStarKpi, setNorthStarKpi] = useState<NorthStarKpi | null>(null)
  const [rawEmployees, setRawEmployees] = useState<EmployeeData[]>([])
  const [serverTeamStats, setServerTeamStats] = useState<TeamStats | null>(null)
  const [motivationData, setMotivationData] = useState<MotivationCalculationResult | null>(null)
  const [motivationGrades, setMotivationGrades] = useState<MotivationGradeConfig[]>([])
  const [deals, setDeals] = useState<DealCard[]>([])
  const [settings, setSettings] = useState<SettingsShape | null>(null)

  // Error states
  const [motivationError, setMotivationError] = useState<string | null>(null)
  const [dealsError, setDealsError] = useState<string | null>(null)

  // Filter states
  const [selectedManagerId, setSelectedManagerId] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<PeriodPreset>('thisMonth')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  })

  // Refresh key for motivation data
  const [motivationRefreshKey, setMotivationRefreshKey] = useState(0)

  const handleDatePresetChange = useCallback((preset: PeriodPreset, nextRange?: DateRange) => {
    setDatePreset(preset)
    if (nextRange) {
      setDateRange(nextRange)
    }
  }, [])

  const refreshMotivation = useCallback(() => {
    setMotivationRefreshKey((key) => key + 1)
  }, [])

  // Recompute views based on filter changes
  const recomputeViews = useCallback((
    employeesList: EmployeeData[],
    managerFilter = selectedManagerId,
    serverStats: TeamStats | null = null,
    currentSettings: SettingsShape | null = null
  ) => {
    const filteredEmployees =
      managerFilter === 'all'
        ? employeesList
        : employeesList.filter((emp) => emp.id === managerFilter)

    const effectiveEmployees = filteredEmployees.length > 0 ? filteredEmployees : employeesList

    const processedStats: ManagerStats[] = effectiveEmployees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      zoomBooked: emp.zoomBooked || 0,
      zoom1Held: emp.zoom1Held || 0,
      zoom2Held: emp.zoom2Held || 0,
      contractReview: emp.contractReview || 0,
      pushCount: emp.pushCount || 0,
      successfulDeals: emp.successfulDeals || 0,
      salesAmount: emp.salesAmount || 0,
      refusals: emp.refusals || 0,
      warming: emp.warming || 0,
      bookedToZoom1: emp.bookedToZoom1 || 0,
      zoom1ToZoom2: emp.zoom1ToZoom2 || 0,
      zoom2ToContract: emp.zoom2ToContract || 0,
      contractToPush: emp.contractToPush || 0,
      pushToDeal: emp.pushToDeal || 0,
      northStar: emp.northStar || 0,
      totalConversion: emp.totalConversion || 0,
      planSales: emp.planSales || 0,
      planDeals: emp.planDeals || 0,
      activityScore: emp.activityScore || 0,
      trend: emp.trend || 'flat',
    }))

    setManagerStats(processedStats)

    let tStats: TeamStats
    let teamReports: EmployeeReport[] = []

    if (managerFilter === 'all' && serverStats) {
      tStats = { ...serverStats }
      teamReports = effectiveEmployees.flatMap((e) => e.reports || [])
    } else {
      teamReports = effectiveEmployees.flatMap((e) => e.reports || [])

      const tStatsRaw = {
        zoomBooked: effectiveEmployees.reduce((sum, e) => sum + (e.zoomBooked || 0), 0),
        zoom1Held: effectiveEmployees.reduce((sum, e) => sum + (e.zoom1Held || 0), 0),
        zoom2Held: effectiveEmployees.reduce((sum, e) => sum + (e.zoom2Held || 0), 0),
        contractReview: effectiveEmployees.reduce((sum, e) => sum + (e.contractReview || 0), 0),
        pushCount: effectiveEmployees.reduce((sum, e) => sum + (e.pushCount || 0), 0),
        successfulDeals: effectiveEmployees.reduce((sum, e) => sum + (e.successfulDeals || 0), 0),
        salesAmount: effectiveEmployees.reduce((sum, e) => sum + (e.salesAmount || 0), 0),
        planSales: effectiveEmployees.reduce((sum, e) => sum + (e.planSales || 0), 0),
        planDeals: effectiveEmployees.reduce((sum, e) => sum + (e.planDeals || 0), 0),
        refusals: effectiveEmployees.reduce((sum, e) => sum + (e.refusals || 0), 0),
        warming: effectiveEmployees.reduce((sum, e) => sum + (e.warming || 0), 0),
      }

      const expectedActivity = tStatsRaw.zoomBooked > 0 ? 100 : 0
      const actualActivity = Math.min(100, Math.round((tStatsRaw.zoom1Held / Math.max(1, tStatsRaw.zoomBooked)) * 100))
      const activityScore = Math.round((expectedActivity + actualActivity) / 2)

      const progress = tStatsRaw.planSales > 0 ? (tStatsRaw.salesAmount / tStatsRaw.planSales) * 100 : 0
      const trend: 'up' | 'flat' | 'down' = progress >= 80 ? 'up' : progress >= 50 ? 'flat' : 'down'

      tStats = {
        ...tStatsRaw,
        bookedToZoom1: safeDiv(tStatsRaw.zoom1Held, tStatsRaw.zoomBooked),
        zoom1ToZoom2: safeDiv(tStatsRaw.zoom2Held, tStatsRaw.zoom1Held),
        zoom2ToContract: safeDiv(tStatsRaw.contractReview, tStatsRaw.zoom2Held),
        contractToPush: safeDiv(tStatsRaw.pushCount, tStatsRaw.contractReview),
        pushToDeal: safeDiv(tStatsRaw.successfulDeals, tStatsRaw.pushCount),
        northStar: safeDiv(tStatsRaw.successfulDeals, tStatsRaw.zoom1Held),
        totalConversion: safeDiv(tStatsRaw.successfulDeals, tStatsRaw.zoomBooked),
        activityScore,
        trend,
      }
    }

    setTeamStats(tStats)
    setTeamFunnel(getFunnelData(tStats, currentSettings?.conversionBenchmarks) as FunnelStage[])

    const { northStarKpi: teamNorthStar } = calculateFullFunnel(
      {
        zoomBooked: tStats.zoomBooked,
        zoom1Held: tStats.zoom1Held,
        zoom2Held: tStats.zoom2Held,
        contractReview: tStats.contractReview,
        push: tStats.pushCount,
        deals: tStats.successfulDeals,
        sales: tStats.salesAmount,
        refusals: tStats.refusals,
        warming: tStats.warming,
      },
      {
        benchmarks: currentSettings?.conversionBenchmarks,
        northStarTarget: currentSettings?.northStarTarget,
      }
    )
    setNorthStarKpi(teamNorthStar)

    // Build trend data
    const dailyMap = new Map<string, TrendDataPoint>()
    teamReports.forEach((r) => {
      const d = new Date(r.date).toISOString().split('T')[0]
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { date: d, sales: 0, deals: 0 })
      }
      const entry = dailyMap.get(d)!
      entry.sales += Number(r.monthlySalesAmount)
      entry.deals += r.successfulDeals
    })

    const finalTrend = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d) => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      }))
    setTrendData(finalTrend)

    // Build alerts
    const newAlerts: DashboardAlert[] = []
    processedStats.forEach((stat) => {
      const issues = analyzeRedZonesWithBenchmarks(
        stat,
        currentSettings?.conversionBenchmarks,
        currentSettings?.alertThresholds,
        currentSettings?.activityTarget,
        currentSettings?.northStarTarget
      )
      issues.forEach((issue) => {
        newAlerts.push({
          id: `${stat.id}-${issue.stage}`,
          type: issue.severity as 'critical' | 'warning' | 'info',
          title: `Проблема на этапе ${issue.stage}`,
          description: `${issue.metric} у сотрудника ${stat.name} составляет ${issue.value}% (Норма: ${issue.benchmark}%)`,
          managerName: stat.name,
        })
      })
    })

    if (tStats.successfulDeals === 0) {
      newAlerts.push({
        id: 'no-deals-team',
        type: 'critical',
        title: 'Отсутствие продаж',
        description: 'За выбранный период в команде не закрыто ни одной сделки.',
      })
    }

    setAlerts(newAlerts)
  }, [selectedManagerId])

  // Fetch employees data
  useEffect(() => {
    async function fetchData() {
      if (user.role !== 'MANAGER') return

      try {
        const response = await fetch(
          `/api/employees?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`
        )
        const data = await response.json()
        const employeesList: EmployeeData[] = data.employees || []
        const tStats: TeamStats | null = data.teamStats || null
        setSettings(data.settings || null)

        setRawEmployees(employeesList)
        setServerTeamStats(tStats)
        recomputeViews(employeesList, selectedManagerId, tStats, data.settings || null)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsInitialLoading(false)
      }
    }

    fetchData()
  }, [user.role, dateRange.start, dateRange.end, selectedManagerId, recomputeViews])

  // Recompute on filter change
  useEffect(() => {
    if (rawEmployees.length === 0) return
    recomputeViews(rawEmployees, selectedManagerId, serverTeamStats, settings)
  }, [selectedManagerId, rawEmployees, serverTeamStats, recomputeViews, settings])

  // Fetch motivation data
  useEffect(() => {
    if (user.role !== 'MANAGER') return

    async function fetchMotivation() {
      setMotivationLoading(true)
      setMotivationError(null)
      try {
        const params = new URLSearchParams({
          managerId: selectedManagerId,
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        })

        const response = await fetch(`/api/motivation/summary?${params.toString()}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Не удалось загрузить мотивацию')
        }

        setMotivationData({
          factTurnover: Number(data.factTurnover || 0),
          hotTurnover: Number(data.hotTurnover || 0),
          forecastTurnover: Number(data.forecastTurnover || 0),
          totalPotentialTurnover: Number(data.totalPotentialTurnover || 0),
          factRate: Number(data.factRate || 0),
          forecastRate: Number(data.forecastRate || 0),
          salaryFact: Number(data.salaryFact || 0),
          salaryForecast: Number(data.salaryForecast || 0),
          potentialGain: Number(data.potentialGain || 0),
        })
        setMotivationGrades((data.grades || []) as MotivationGradeConfig[])
      } catch (error) {
        console.error('Error fetching motivation summary:', error)
        setMotivationError(error instanceof Error ? error.message : 'Ошибка загрузки данных')
      } finally {
        setMotivationLoading(false)
      }
    }

    fetchMotivation()
  }, [user.role, selectedManagerId, dateRange.start, dateRange.end, motivationRefreshKey])

  // Fetch deals
  useEffect(() => {
    if (user.role !== 'MANAGER') return

    async function fetchDeals() {
      setDealsLoading(true)
      setDealsError(null)
      try {
        const params = new URLSearchParams({
          managerId: selectedManagerId,
          status: 'OPEN',
          limit: '20',
        })
        const response = await fetch(`/api/deals?${params.toString()}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Не удалось загрузить сделки')
        }

        setDeals(
          (data.deals || []).map(
            (deal: { id: string; budget?: number | string; isFocus?: boolean; [key: string]: unknown }) =>
              ({
                ...deal,
                budget: Number(deal.budget || 0),
              }) as DealCard
          )
        )
      } catch (error) {
        console.error('Error fetching deals:', error)
        setDealsError(error instanceof Error ? error.message : 'Ошибка загрузки сделок')
      } finally {
        setDealsLoading(false)
      }
    }

    fetchDeals()
  }, [user.role, selectedManagerId, motivationRefreshKey])

  // Set loading false for non-managers
  useEffect(() => {
    if (user.role !== 'MANAGER') {
      setIsInitialLoading(false)
    }
  }, [user.role])

  // Handle deal focus toggle
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

      setMotivationRefreshKey((key) => key + 1)
    } catch (error) {
      console.error('Failed to update deal focus', error)
      setDeals((prev) =>
        prev.map((deal) => (deal.id === dealId ? { ...deal, isFocus: !nextValue } : deal))
      )
      setDealsError(error instanceof Error ? error.message : 'Ошибка обновления сделки')
    }
  }, [])

  // Build sparklines
  const managerSparklines = useMemo(() => {
    return buildManagerSparklines(rawEmployees, 7)
  }, [rawEmployees])

  return {
    // Loading states
    isInitialLoading,
    motivationLoading,
    dealsLoading,

    // Data
    managerStats,
    teamFunnel,
    trendData,
    alerts,
    teamStats,
    northStarKpi,
    rawEmployees,
    motivationData,
    motivationGrades,
    deals,
    settings,
    managerSparklines,

    // Errors
    motivationError,
    dealsError,

    // Filters
    selectedManagerId,
    datePreset,
    dateRange,

    // Actions
    setSelectedManagerId,
    handleDatePresetChange,
    handleToggleFocus,
    refreshMotivation,
  }
}
