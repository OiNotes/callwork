import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { FUNNEL_STAGES } from '@/lib/config/conversionBenchmarks'
import { calculateManagerStats, ManagerStats } from '@/lib/analytics/funnel'
import { getSettingsForUser } from '@/lib/settings/context'
import { GoalService } from '@/lib/services/GoalService'
import { roundMoney, toDecimal, toNumber } from '@/lib/utils/decimal'
import { z } from 'zod'
import type { SettingsShape } from '@/lib/settings/getSettings'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

interface FunnelStageForChart {
  stage: string
  count: number
  conversion_rate: number
  is_red_zone: boolean
}

interface EmployeeConversionRow {
  employee_id: string
  employee_name: string
  stage: string
  count: number
  conversion_rate: number
}

interface FunnelResponse {
  funnel: FunnelStageForChart[]
  rawFunnel: ReturnType<typeof calculateFullFunnel>['funnel']
  employeeConversions: EmployeeConversionRow[]
  period: {
    start: string
    end: string
  }
  totals: {
    zoomBooked: number
    zoom1Held: number
    zoom2Held: number
    contractReview: number
    push: number
    deals: number
    sales: number
    refusals: number
    warming: number
  }
  topPerformers: Array<ManagerStats & { id: string; name: string }>
  bottomPerformers: Array<ManagerStats & { id: string; name: string }>
  sideFlow: ReturnType<typeof calculateFullFunnel>['sideFlow']
  northStarKpi: ReturnType<typeof calculateFullFunnel>['northStarKpi']
  settings: SettingsShape
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const querySchema = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      userId: z.string().cuid().optional(),
    })
    const parsedQuery = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const { startDate: startDateParam, endDate: endDateParam, userId: userIdParam } = parsedQuery.data
    if (startDateParam && endDateParam && new Date(startDateParam) > new Date(endDateParam)) {
      return NextResponse.json({ error: 'Invalid period range' }, { status: 400 })
    }

    const now = new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = endDateParam ? new Date(endDateParam) : new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const isAdmin = user.role === 'ADMIN'
    const isManager = user.role === 'MANAGER'

    const teamUserIds =
      isManager
        ? await prisma.user
            .findMany({
              where: {
                OR: [{ id: user.id }, { managerId: user.id }],
                isActive: true,
              },
              select: { id: true },
            })
            .then((rows) => rows.map((row) => row.id))
        : null

    let targetUserId: string | undefined
    if (userIdParam) {
      if (isAdmin) {
        const targetUser = await prisma.user.findFirst({
          where: { id: userIdParam, isActive: true },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden: Cannot access other users data' }, { status: 403 })
        }
        targetUserId = userIdParam
      } else if (isManager) {
        if (!teamUserIds?.includes(userIdParam)) {
          return NextResponse.json({ error: 'Forbidden: Cannot access other users data' }, { status: 403 })
        }
        targetUserId = userIdParam
      } else if (userIdParam !== user.id) {
        return NextResponse.json({ error: 'Forbidden: Cannot access other users data' }, { status: 403 })
      } else {
        targetUserId = user.id
      }
    }

    const whereClause = {
      date: { gte: startDate, lte: endDate },
      ...(targetUserId
        ? { userId: targetUserId }
        : isManager && teamUserIds
          ? { userId: { in: teamUserIds } }
          : isAdmin
            ? {}
            : { userId: user.id }),
    }

    const { settings } = await getSettingsForUser(user.id, user.role)

    const aggregate = await prisma.report.aggregate({
      where: whereClause,
      _sum: {
        zoomAppointments: true,
        pzmConducted: true,
        vzmConducted: true,
        successfulDeals: true,
        monthlySalesAmount: true,
        refusalsCount: true,
        warmingUpCount: true,
        contractReviewCount: true,
        pushCount: true,
      },
    })

    const refusalByStageTotals = await prisma.report
      .findMany({
        where: whereClause,
        select: { refusalsByStage: true },
      })
      .then((reports) =>
        reports.reduce<Record<string, number>>((acc, report) => {
          const payload = (report.refusalsByStage as Record<string, unknown> | null) || {}
          Object.entries(payload).forEach(([stage, value]) => {
            const numeric = typeof value === 'number' ? value : Number(value)
            if (Number.isFinite(numeric)) {
              acc[stage] = (acc[stage] || 0) + numeric
            }
          })
          return acc
        }, {})
      )

    const totals = {
      zoomBooked: aggregate._sum.zoomAppointments || 0,
      zoom1Held: aggregate._sum.pzmConducted || 0,
      zoom2Held: aggregate._sum.vzmConducted || 0,
      contractReview: aggregate._sum.contractReviewCount || 0,
      push: (aggregate._sum.pushCount as number | null) ?? aggregate._sum.contractReviewCount ?? 0,
      deals: aggregate._sum.successfulDeals || 0,
      sales: toNumber(roundMoney(toDecimal(aggregate._sum.monthlySalesAmount || 0))),
      refusals: aggregate._sum.refusalsCount || 0,
      warming: aggregate._sum.warmingUpCount || 0,
      refusalByStage: refusalByStageTotals,
    }

    const { funnel, sideFlow, northStarKpi } = calculateFullFunnel(totals, {
      benchmarks: settings.conversionBenchmarks,
      northStarTarget: settings.northStarTarget,
    })

    const funnelForChart: FunnelStageForChart[] = funnel.map((stage) => ({
      stage: stage.stage,
      count: stage.value,
      conversion_rate: stage.conversion,
      is_red_zone: stage.isRedZone,
    }))

    const employees = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true,
        ...(isManager ? { managerId: user.id } : isAdmin ? {} : { id: user.id }),
        ...(targetUserId && { id: targetUserId }),
      },
      include: {
        reports: {
          where: { date: { gte: startDate, lte: endDate } },
        },
      },
    })
    const employeeGoals = await GoalService.getUsersGoals(employees.map((emp) => emp.id))

    const managerStats: Array<ManagerStats & { id: string; name: string }> = await Promise.all(
      employees.map(async (emp): Promise<ManagerStats & { id: string; name: string }> => ({
        ...(await calculateManagerStats(emp.reports, emp.id, {
          salesPerDeal: settings.salesPerDeal,
          planMode: 'user',
          planSalesOverride: employeeGoals[emp.id] ?? 0,
        })),
        id: emp.id,
        name: emp.name,
      }))
    )

    const employeeConversions: EmployeeConversionRow[] = managerStats.flatMap((stat) => {
      const transitions = [
        { label: FUNNEL_STAGES.find((s) => s.id === 'zoom1Held')?.label || '1-й Zoom', value: stat.zoom1Held, conversion: stat.bookedToZoom1 },
        { label: FUNNEL_STAGES.find((s) => s.id === 'zoom2Held')?.label || '2-й Zoom', value: stat.zoom2Held, conversion: stat.zoom1ToZoom2 },
        { label: FUNNEL_STAGES.find((s) => s.id === 'contractReview')?.label || 'Разбор', value: stat.contractReview, conversion: stat.zoom2ToContract },
        { label: FUNNEL_STAGES.find((s) => s.id === 'push')?.label || 'Дожим', value: stat.pushCount, conversion: stat.contractToPush },
        { label: FUNNEL_STAGES.find((s) => s.id === 'deal')?.label || 'Оплата', value: stat.successfulDeals, conversion: stat.pushToDeal },
      ]

      return transitions.map((stage) => ({
        employee_id: stat.id,
        employee_name: stat.name,
        stage: stage.label,
        count: stage.value,
        conversion_rate: stage.conversion,
      }))
    })

    const sortedByPush = [...managerStats].sort((a, b) => b.pushToDeal - a.pushToDeal)
    const topPerformers = sortedByPush.slice(0, 3)
    const bottomPerformers = sortedByPush.slice(-3).reverse()

    const response: FunnelResponse = {
      funnel: funnelForChart,
      rawFunnel: funnel,
      employeeConversions,
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      totals,
      topPerformers,
      bottomPerformers,
      sideFlow,
      northStarKpi,
      settings,
    }

    return jsonWithPrivateCache(response)
  } catch (error) {
    logError('Funnel API error', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
