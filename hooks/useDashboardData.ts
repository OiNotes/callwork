'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { computeConversions, resolveNorthStarStatus } from '@/lib/calculations/metrics'
import { analyzeRedZonesWithBenchmarks, getFunnelData, type ManagerStats, type FunnelStage } from '@/lib/analytics/funnel.client'
import { roundMoney, toDecimal, toNumber, safeRate } from '@/lib/utils/decimal'
import type { MotivationCalculationResult } from '@/lib/motivation/motivationCalculator'
import type { MotivationGradeConfig } from '@/lib/config/motivationGrades'
import type { AlertThresholdConfig, ConversionBenchmarkConfig } from '@/lib/services/RopSettingsService'
import type { NorthStarKpi } from '@/lib/calculations/funnel'
import type { DealCard } from '@/components/deals/DealsList'
import type { DashboardAlert, TrendDataPoint, TeamStats } from '@/components/dashboard/types'

export interface DashboardFilters {
  managerId?: string
  startDate: string
  endDate: string
  page?: number
  limit?: number
}

interface DashboardEmployeeMetricsResponse {
  zoomBooked: number
  pzmConducted: number
  vzmConducted: number
  contractReviewCount: number
  pushCount: number
  successfulDeals: number
  monthlySalesAmount: string
  reportsCount: number
}

interface DashboardEmployeeResponse {
  id: string
  name: string
  role: string
  isActive: boolean
  monthlyGoal: string | null
  metrics: DashboardEmployeeMetricsResponse
  funnel: Array<{
    id: string
    stage: string
    value: number
    conversion: number
  }>
}

interface DashboardTeamTotalsResponse {
  zoomBooked: number
  pzmConducted: number
  vzmConducted: number
  contractReviewCount: number
  pushCount: number
  successfulDeals: number
  monthlySalesAmount: string
  totalGoal: string
  goalProgress: number
}

interface DashboardFunnelStageResponse {
  id: string
  stage: string
  value: number
  conversion: number
  benchmark: number
}

interface DashboardAlertResponse {
  id: string
  type: string
  severity: string
  title: string
  userId: string | null
  userName: string | null
  isRead: boolean
  createdAt: string
}

interface DashboardDealResponse {
  id: string
  title: string
  budget: string
  status: string
  paymentStatus: string
  isFocus: boolean
  managerId: string
  managerName: string | null
}

interface DashboardPaginationResponse {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

interface DashboardSettingsResponse {
  conversionBenchmarks: ConversionBenchmarkConfig
  alertThresholds: AlertThresholdConfig
  activityTarget: number
  northStarTarget: number
  salesPerDeal: number
}

interface DashboardTrendResponse {
  date: string
  sales: number
  deals: number
  pzm: number
  vzm: number
}

interface DashboardResponse {
  employees: DashboardEmployeeResponse[]
  teamTotals: DashboardTeamTotalsResponse
  funnel: DashboardFunnelStageResponse[]
  alerts: DashboardAlertResponse[]
  deals: DashboardDealResponse[]
  pagination: DashboardPaginationResponse
  trend: DashboardTrendResponse[]
  motivation: MotivationCalculationResult
  motivationGrades: MotivationGradeConfig[]
  settings: DashboardSettingsResponse
}

export interface DashboardEmployee {
  id: string
  name: string
  role: string
  isActive: boolean
  monthlyGoal: number | null
  metrics: {
    zoomBooked: number
    pzmConducted: number
    vzmConducted: number
    contractReviewCount: number
    pushCount: number
    successfulDeals: number
    monthlySalesAmount: number
    reportsCount: number
  }
  conversions: {
    bookedToZoom1: number
    zoom1ToZoom2: number
    zoom2ToContract: number
    contractToPush: number
    pushToDeal: number
    northStar: number
    totalConversion: number
  }
  planSales: number
  planDeals: number
  activityScore: number
  trend: 'up' | 'flat' | 'down'
}

export interface DashboardData {
  employees: DashboardEmployee[]
  teamTotals: {
    zoomBooked: number
    pzmConducted: number
    vzmConducted: number
    contractReviewCount: number
    pushCount: number
    successfulDeals: number
    monthlySalesAmount: number
    totalGoal: number
    goalProgress: number
  }
  funnel: Array<DashboardFunnelStageResponse & { dropoff: number }>
  alerts: DashboardAlertResponse[]
  unreadAlerts: DashboardAlertResponse[]
  deals: DealCard[]
  northStar: number
  pagination: DashboardPaginationResponse
  trendData: TrendDataPoint[]
  weeklyActivityData: Array<{ day: string; pzm: number; vzm: number; deals: number }>
  redZoneAlerts: DashboardAlert[]
  teamStats: TeamStats
  teamFunnel: FunnelStage[]
  northStarKpi: NorthStarKpi | null
  motivationData: MotivationCalculationResult | null
  motivationGrades: MotivationGradeConfig[]
  settings: DashboardSettingsResponse | null
}

const parseMoney = (value: string | number | null | undefined) =>
  toNumber(roundMoney(toDecimal(value ?? 0)))

async function fetchDashboard(filters: DashboardFilters): Promise<DashboardResponse> {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    page: String(filters.page ?? 1),
    limit: String(filters.limit ?? 50),
    ...(filters.managerId ? { managerId: filters.managerId } : {}),
  })

  const res = await fetch(`/api/dashboard?${params}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error(`Dashboard fetch failed: ${res.status}`)
  }

  return res.json()
}

const buildTeamStats = (
  totals: DashboardTeamTotalsResponse,
  settings: DashboardSettingsResponse | null
): { teamStats: TeamStats; teamFunnel: FunnelStage[]; northStarKpi: NorthStarKpi | null } => {
  const planSales = parseMoney(totals.totalGoal)
  const salesAmount = parseMoney(totals.monthlySalesAmount)
  const salesPerDeal = settings?.salesPerDeal ?? 100_000

  const conversions = computeConversions(
    {
      zoomBooked: totals.zoomBooked,
      zoom1Held: totals.pzmConducted,
      zoom2Held: totals.vzmConducted,
      contractReview: totals.contractReviewCount,
      push: totals.pushCount,
      deals: totals.successfulDeals,
    },
    { benchmarks: settings?.conversionBenchmarks }
  )

  const convMap = Object.fromEntries(conversions.stages.map((stage) => [stage.id, stage.conversion]))

  const planDeals = planSales > 0 ? Math.round(planSales / salesPerDeal) : 0
  const progress = planSales > 0 ? (salesAmount / planSales) * 100 : 0
  const trend: 'up' | 'flat' | 'down' = progress >= 80 ? 'up' : progress >= 50 ? 'flat' : 'down'

  const expectedActivity = totals.zoomBooked > 0 ? 100 : 0
  const actualActivity = Math.min(100, Math.round((totals.pzmConducted / Math.max(1, totals.zoomBooked)) * 100))
  const activityScore = Math.round((expectedActivity + actualActivity) / 2)

  const teamStats: TeamStats = {
    zoomBooked: totals.zoomBooked,
    zoom1Held: totals.pzmConducted,
    zoom2Held: totals.vzmConducted,
    contractReview: totals.contractReviewCount,
    pushCount: totals.pushCount,
    successfulDeals: totals.successfulDeals,
    salesAmount,
    planSales,
    planDeals,
    refusals: 0,
    warming: 0,
    bookedToZoom1: (convMap.zoom1Held as number) || 0,
    zoom1ToZoom2: (convMap.zoom2Held as number) || 0,
    zoom2ToContract: (convMap.contractReview as number) || 0,
    contractToPush: (convMap.push as number) || 0,
    pushToDeal: (convMap.deal as number) || 0,
    northStar: conversions.northStar,
    totalConversion: conversions.totalConversion,
    activityScore,
    trend,
  }

  const teamFunnel = getFunnelData(teamStats, settings?.conversionBenchmarks) as FunnelStage[]
  const northStarKpi: NorthStarKpi = {
    value: conversions.northStar,
    ...resolveNorthStarStatus(conversions.northStar, settings?.northStarTarget),
  }

  return { teamStats, teamFunnel, northStarKpi }
}

export function useDashboardData(filters: DashboardFilters, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => fetchDashboard(filters),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  })

  const derivedData = useMemo<DashboardData | null>(() => {
    if (!query.data) return null

    const settings = query.data.settings ?? null

    const employees: DashboardEmployee[] = query.data.employees.map((employee) => {
      const monthlySalesAmount = parseMoney(employee.metrics.monthlySalesAmount)
      const planSales = parseMoney(employee.monthlyGoal)
      const salesPerDeal = settings?.salesPerDeal ?? 100_000
      const planDeals = planSales > 0 ? Math.round(planSales / salesPerDeal) : 0
      const progress = planSales > 0 ? (monthlySalesAmount / planSales) * 100 : 0
      const trend: 'up' | 'flat' | 'down' = progress >= 80 ? 'up' : progress >= 50 ? 'flat' : 'down'
      const expectedActivity = employee.metrics.zoomBooked > 0 ? 100 : 0
      const actualActivity = Math.min(
        100,
        Math.round((employee.metrics.pzmConducted / Math.max(1, employee.metrics.zoomBooked)) * 100)
      )
      const activityScore = Math.round((expectedActivity + actualActivity) / 2)

      const conversions = computeConversions(
        {
          zoomBooked: employee.metrics.zoomBooked,
          zoom1Held: employee.metrics.pzmConducted,
          zoom2Held: employee.metrics.vzmConducted,
          contractReview: employee.metrics.contractReviewCount,
          push: employee.metrics.pushCount,
          deals: employee.metrics.successfulDeals,
        },
        { benchmarks: settings?.conversionBenchmarks }
      )

      const convMap = Object.fromEntries(conversions.stages.map((stage) => [stage.id, stage.conversion]))

      return {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        isActive: employee.isActive,
        monthlyGoal: employee.monthlyGoal ? parseMoney(employee.monthlyGoal) : null,
        metrics: {
          zoomBooked: employee.metrics.zoomBooked,
          pzmConducted: employee.metrics.pzmConducted,
          vzmConducted: employee.metrics.vzmConducted,
          contractReviewCount: employee.metrics.contractReviewCount,
          pushCount: employee.metrics.pushCount,
          successfulDeals: employee.metrics.successfulDeals,
          monthlySalesAmount,
          reportsCount: employee.metrics.reportsCount,
        },
        conversions: {
          bookedToZoom1: (convMap.zoom1Held as number) || 0,
          zoom1ToZoom2: (convMap.zoom2Held as number) || 0,
          zoom2ToContract: (convMap.contractReview as number) || 0,
          contractToPush: (convMap.push as number) || 0,
          pushToDeal: (convMap.deal as number) || 0,
          northStar: conversions.northStar,
          totalConversion: conversions.totalConversion,
        },
        planSales,
        planDeals,
        activityScore,
        trend,
      }
    })

    const totals = query.data.teamTotals
    const { teamStats, teamFunnel, northStarKpi } = buildTeamStats(totals, settings)

    const funnelWithConversions = query.data.funnel.map((stage, i) => ({
      ...stage,
      dropoff:
        i < query.data.funnel.length - 1
          ? Math.round((1 - query.data.funnel[i + 1].value / Math.max(stage.value, 1)) * 100)
          : 0,
    }))

    const northStar = query.data.funnel.length >= 6
      ? safeRate(query.data.funnel[5].value, Math.max(query.data.funnel[1]?.value ?? 0, 1))
      : 0

    const unreadAlerts = query.data.alerts.filter((alert) => !alert.isRead)

    const deals: DealCard[] = query.data.deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      budget: parseMoney(deal.budget),
      status: deal.status as DealCard['status'],
      paymentStatus: deal.paymentStatus as DealCard['paymentStatus'],
      isFocus: deal.isFocus,
      updatedAt: undefined,
    }))

    const trendData: TrendDataPoint[] = query.data.trend.map((point) => ({
      date: new Date(point.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      sales: parseMoney(point.sales),
      deals: point.deals,
    }))

    const weeklyActivityData = query.data.trend.slice(-7).map((point) => ({
      day: new Date(point.date).toLocaleDateString('ru-RU', { weekday: 'short' }),
      pzm: point.pzm,
      vzm: point.vzm,
      deals: point.deals,
    }))

    const redZoneAlerts: DashboardAlert[] = employees.flatMap((employee) => {
      const stats: ManagerStats = {
        id: employee.id,
        name: employee.name,
        zoomBooked: employee.metrics.zoomBooked,
        zoom1Held: employee.metrics.pzmConducted,
        zoom2Held: employee.metrics.vzmConducted,
        contractReview: employee.metrics.contractReviewCount,
        pushCount: employee.metrics.pushCount,
        successfulDeals: employee.metrics.successfulDeals,
        salesAmount: employee.metrics.monthlySalesAmount,
        refusals: 0,
        warming: 0,
        bookedToZoom1: employee.conversions.bookedToZoom1,
        zoom1ToZoom2: employee.conversions.zoom1ToZoom2,
        zoom2ToContract: employee.conversions.zoom2ToContract,
        contractToPush: employee.conversions.contractToPush,
        pushToDeal: employee.conversions.pushToDeal,
        northStar: employee.conversions.northStar,
        totalConversion: employee.conversions.totalConversion,
        planSales: employee.planSales,
        planDeals: employee.planDeals,
        activityScore: employee.activityScore,
        trend: employee.trend,
      }

      const issues = analyzeRedZonesWithBenchmarks(
        stats,
        settings?.conversionBenchmarks,
        settings?.alertThresholds,
        settings?.activityTarget,
        settings?.northStarTarget
      )

      return issues.map((issue) => ({
        id: `${employee.id}-${issue.stage}`,
        type: issue.severity as 'critical' | 'warning' | 'info',
        title: `Проблема на этапе ${issue.stage}`,
        description: `${issue.metric} у сотрудника ${employee.name} составляет ${issue.value}% (Норма: ${issue.benchmark}%)`,
        managerName: employee.name,
      }))
    })

    return {
      employees,
      teamTotals: {
        zoomBooked: totals.zoomBooked,
        pzmConducted: totals.pzmConducted,
        vzmConducted: totals.vzmConducted,
        contractReviewCount: totals.contractReviewCount,
        pushCount: totals.pushCount,
        successfulDeals: totals.successfulDeals,
        monthlySalesAmount: parseMoney(totals.monthlySalesAmount),
        totalGoal: parseMoney(totals.totalGoal),
        goalProgress: totals.goalProgress,
      },
      funnel: funnelWithConversions,
      alerts: query.data.alerts,
      unreadAlerts,
      deals,
      northStar,
      pagination: query.data.pagination,
      trendData,
      weeklyActivityData,
      redZoneAlerts,
      teamStats,
      teamFunnel,
      northStarKpi,
      motivationData: query.data.motivation ?? null,
      motivationGrades: query.data.motivationGrades ?? [],
      settings,
    }
  }, [query.data])

  return {
    data: derivedData,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
