import { prisma } from '@/lib/prisma'
import { GoalService } from '@/lib/services/GoalService'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { getSettingsForUser } from '@/lib/settings/context'
import { roundMoney, toDecimal, toNumber, type Decimal } from '@/lib/utils/decimal'
import { subHours } from 'date-fns'
import type { Role } from '@prisma/client'

type AuthUser = { id: string; role: Role }

type Totals = {
  sales: Decimal
  deals: number
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  push: number
  refusals: number
  warming: number
}

export interface TVFunnelStage {
  id: string
  label: string
  conversion: number
  benchmark: number
  isRedZone: boolean
}

export interface TVLeaderboardEntry {
  id: string
  rank: number
  name: string
  sales: number
  deals: number
  goal: number
  progress: number
}

export interface TVRecentDeal {
  id: string
  userId: string
  userName: string
  amount: number
  deals: number
  createdAt: string
}

export interface TVRedZoneEntry {
  id: string
  name: string
  stage: string
  conversion: number
  benchmark: number
}

export interface TVData {
  period: {
    start: string
    end: string
  }
  summary: {
    sales: number
    deals: number
    plan: number
    progress: number
  }
  funnel: TVFunnelStage[]
  leaderboard: TVLeaderboardEntry[]
  recentDeals: TVRecentDeal[]
  redZones: TVRedZoneEntry[]
}

const createTotals = (): Totals => ({
  sales: toDecimal(0),
  deals: 0,
  zoomBooked: 0,
  zoom1Held: 0,
  zoom2Held: 0,
  contractReview: 0,
  push: 0,
  refusals: 0,
  warming: 0,
})

const getPeriodRange = (periodStartDay: number) => {
  const now = new Date()
  const safeStartDay = Math.min(31, Math.max(1, Math.floor(periodStartDay)))
  const startDate = new Date(now.getFullYear(), now.getMonth(), safeStartDay)
  if (safeStartDay > now.getDate()) {
    startDate.setMonth(startDate.getMonth() - 1)
  }
  startDate.setHours(0, 0, 0, 0)
  return { startDate, endDate: now }
}

const toMoneyNumber = (value: unknown) => toNumber(roundMoney(toDecimal(value)))

export async function getTVData(user: AuthUser): Promise<TVData> {
  const { settings } = await getSettingsForUser(user.id, user.role)
  const { startDate, endDate } = getPeriodRange(settings.periodStartDay ?? 1)

  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      isActive: true,
      ...(user.role === 'MANAGER'
        ? { managerId: user.id }
        : user.role === 'ADMIN'
          ? {}
          : { id: user.id }),
    },
    select: { id: true, name: true },
  })

  const employeeIds = employees.map((emp) => emp.id)

  const [reports, recentReports, goalsByUser, planValue] = await Promise.all([
    employeeIds.length
      ? prisma.report.findMany({
          where: {
            userId: { in: employeeIds },
            date: { gte: startDate, lte: endDate },
          },
          select: {
            userId: true,
            zoomAppointments: true,
            pzmConducted: true,
            vzmConducted: true,
            contractReviewCount: true,
            pushCount: true,
            successfulDeals: true,
            monthlySalesAmount: true,
            refusalsCount: true,
            warmingUpCount: true,
          },
        })
      : Promise.resolve([]),
    employeeIds.length
      ? prisma.report.findMany({
          where: {
            userId: { in: employeeIds },
            createdAt: { gte: subHours(new Date(), 24) },
            successfulDeals: { gt: 0 },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        })
      : Promise.resolve([]),
    GoalService.getUsersGoals(employeeIds),
    user.role === 'MANAGER' || user.role === 'ADMIN'
      ? GoalService.getTeamGoal(user.id)
      : GoalService.getUserGoal(user.id),
  ])
  const plan = planValue ?? 0

  const totalsByUser = new Map<string, Totals>()
  const teamTotals = createTotals()

  for (const report of reports) {
    const existing = totalsByUser.get(report.userId) ?? createTotals()
    existing.zoomBooked += report.zoomAppointments
    existing.zoom1Held += report.pzmConducted
    existing.zoom2Held += report.vzmConducted
    existing.contractReview += report.contractReviewCount
    existing.push += report.pushCount ?? report.contractReviewCount ?? 0
    existing.deals += report.successfulDeals
    existing.sales = existing.sales.plus(toDecimal(report.monthlySalesAmount))
    existing.refusals += report.refusalsCount
    existing.warming += report.warmingUpCount
    totalsByUser.set(report.userId, existing)

    teamTotals.zoomBooked += report.zoomAppointments
    teamTotals.zoom1Held += report.pzmConducted
    teamTotals.zoom2Held += report.vzmConducted
    teamTotals.contractReview += report.contractReviewCount
    teamTotals.push += report.pushCount ?? report.contractReviewCount ?? 0
    teamTotals.deals += report.successfulDeals
    teamTotals.sales = teamTotals.sales.plus(toDecimal(report.monthlySalesAmount))
    teamTotals.refusals += report.refusalsCount
    teamTotals.warming += report.warmingUpCount
  }

  const teamSales = toMoneyNumber(teamTotals.sales)
  const teamDeals = teamTotals.deals

  const { funnel } = calculateFullFunnel(
    {
      zoomBooked: teamTotals.zoomBooked,
      zoom1Held: teamTotals.zoom1Held,
      zoom2Held: teamTotals.zoom2Held,
      contractReview: teamTotals.contractReview,
      push: teamTotals.push,
      deals: teamTotals.deals,
      sales: teamSales,
      refusals: teamTotals.refusals,
      warming: teamTotals.warming,
    },
    {
      benchmarks: settings.conversionBenchmarks,
      northStarTarget: settings.northStarTarget,
    }
  )

  const funnelStages: TVFunnelStage[] = funnel.map((stage) => ({
    id: stage.id,
    label: stage.stage,
    conversion: stage.conversion,
    benchmark: stage.benchmark,
    isRedZone: stage.isRedZone,
  }))

  const leaderboard = employees
    .map((emp) => {
      const totals = totalsByUser.get(emp.id) ?? createTotals()
      const sales = toMoneyNumber(totals.sales)
      const deals = totals.deals
      const goal = goalsByUser[emp.id] ?? 0
      const progress = goal > 0 ? Math.round((sales / goal) * 100) : 0

      return {
        id: emp.id,
        rank: 0,
        name: emp.name,
        sales,
        deals,
        goal,
        progress,
      }
    })
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  const redZones = employees
    .map((emp) => {
      const totals = totalsByUser.get(emp.id) ?? createTotals()
      const hasActivity =
        totals.zoomBooked > 0 ||
        totals.zoom1Held > 0 ||
        totals.zoom2Held > 0 ||
        totals.deals > 0

      if (!hasActivity) return null

      const { funnel: employeeFunnel } = calculateFullFunnel(
        {
          zoomBooked: totals.zoomBooked,
          zoom1Held: totals.zoom1Held,
          zoom2Held: totals.zoom2Held,
          contractReview: totals.contractReview,
          push: totals.push,
          deals: totals.deals,
          sales: toMoneyNumber(totals.sales),
          refusals: totals.refusals,
          warming: totals.warming,
        },
        { benchmarks: settings.conversionBenchmarks }
      )

      const redStages = employeeFunnel.filter((stage) => stage.isRedZone)
      if (redStages.length === 0) return null

      const worstStage = redStages.reduce((worst, stage) => {
        const ratio = stage.benchmark > 0 ? stage.conversion / stage.benchmark : 0
        if (!worst || ratio < worst.ratio) {
          return { stage, ratio }
        }
        return worst
      }, null as { stage: typeof redStages[number]; ratio: number } | null)

      if (!worstStage) return null

      return {
        id: emp.id,
        name: emp.name,
        stage: worstStage.stage.stage,
        conversion: worstStage.stage.conversion,
        benchmark: worstStage.stage.benchmark,
      }
    })
    .filter((item): item is TVRedZoneEntry => Boolean(item))
    .sort((a, b) => {
      const ratioA = a.benchmark > 0 ? a.conversion / a.benchmark : 0
      const ratioB = b.benchmark > 0 ? b.conversion / b.benchmark : 0
      return ratioA - ratioB
    })
    .slice(0, 5)

  const recentDeals: TVRecentDeal[] = recentReports.map((report) => ({
    id: report.id,
    userId: report.user.id,
    userName: report.user.name,
    amount: toMoneyNumber(report.monthlySalesAmount),
    deals: report.successfulDeals,
    createdAt: report.createdAt.toISOString(),
  }))

  const progress = plan > 0 ? Math.round((teamSales / plan) * 100) : 0

  return {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary: {
      sales: teamSales,
      deals: teamDeals,
      plan: plan ?? 0,
      progress,
    },
    funnel: funnelStages,
    leaderboard,
    recentDeals,
    redZones,
  }
}
