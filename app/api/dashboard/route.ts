import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireManager } from '@/lib/auth/get-session'
import { getSettingsForUser } from '@/lib/settings/context'
import { getMotivationSummaryForManagers } from '@/lib/motivation/motivationService'
import { GoalService } from '@/lib/services/GoalService'
import { computeConversions, getStageLabel } from '@/lib/calculations/metrics'
import { calcPercent, roundMoney, roundPercent, sumDecimals, toDecimal } from '@/lib/utils/decimal'
import { jsonWithPrivateCache } from '@/lib/utils/http'
import { z } from 'zod'
import { DealStatus, Prisma, Role } from '@prisma/client'
import { logError } from '@/lib/logger'

const toMoneyString = (value: unknown) => roundMoney(toDecimal(value)).toFixed(2)

export async function GET(request: Request) {
  try {
    const user = await requireManager()
    const { searchParams } = new URL(request.url)

    const querySchema = z.object({
      managerId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      managerId: searchParams.get('managerId') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }

    const requestedManagerId =
      parsedQuery.data.managerId && parsedQuery.data.managerId !== 'all'
        ? parsedQuery.data.managerId
        : null

    const startDate = parsedQuery.data.startDate
      ? new Date(parsedQuery.data.startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 1))
    const endDate = parsedQuery.data.endDate ? new Date(parsedQuery.data.endDate) : new Date()

    if (startDate > endDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const skip = (page - 1) * limit

    const isAdmin = user.role === 'ADMIN'

    const baseEmployeesWhere: Prisma.UserWhereInput = isAdmin
      ? { role: Role.EMPLOYEE, isActive: true }
      : { role: Role.EMPLOYEE, isActive: true, managerId: user.id }

    const employeesWhere: Prisma.UserWhereInput = requestedManagerId
      ? { ...baseEmployeesWhere, id: requestedManagerId }
      : baseEmployeesWhere

    const [{ settings }, employeesPage, totalEmployees, employeesAll] = await Promise.all([
      getSettingsForUser(user.id, user.role),
      prisma.user.findMany({
        where: employeesWhere,
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          monthlyGoal: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: employeesWhere }),
      prisma.user.findMany({
        where: employeesWhere,
        select: {
          id: true,
          monthlyGoal: true,
        },
      }),
    ])

    const employeeIds = employeesAll.map((employee) => employee.id)
    const teamUserIds =
      requestedManagerId || isAdmin ? employeeIds : [user.id, ...employeeIds]

    const reportsWhere: Prisma.ReportWhereInput =
      teamUserIds.length === 0
        ? { userId: 'no-match' }
        : {
            userId: { in: teamUserIds },
            date: {
              gte: startDate,
              lte: endDate,
            },
          }

    const [
      reportAggregates,
      trendAggregates,
      deals,
      alerts,
      motivation,
      managerGoal,
    ] = await Promise.all([
      prisma.report.groupBy({
        by: ['userId'],
        where: reportsWhere,
        _sum: {
          zoomAppointments: true,
          pzmConducted: true,
          vzmConducted: true,
          contractReviewCount: true,
          pushCount: true,
          successfulDeals: true,
          monthlySalesAmount: true,
        },
        _count: { _all: true },
      }),
      prisma.report.groupBy({
        by: ['date'],
        where: reportsWhere,
        _sum: {
          successfulDeals: true,
          monthlySalesAmount: true,
          pzmConducted: true,
          vzmConducted: true,
        },
        orderBy: { date: 'asc' },
      }),
      prisma.deal.findMany({
        where: {
          managerId: { in: employeeIds.length > 0 ? employeeIds : ['no-match'] },
          status: DealStatus.OPEN,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          budget: true,
          status: true,
          paymentStatus: true,
          isFocus: true,
          managerId: true,
          manager: {
            select: { name: true },
          },
        },
      }),
      prisma.alert.findMany({
        where: isAdmin
          ? {}
          : user.role === 'MANAGER'
            ? {
                OR: [
                  { userId: null },
                  { userId: { in: [user.id, ...employeeIds] } },
                ],
              }
            : { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          userId: true,
          isRead: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      getMotivationSummaryForManagers(
        employeeIds.length > 0 ? employeeIds : [],
        { startDate, endDate },
        settings.motivation?.grades
      ),
      requestedManagerId || isAdmin ? null : GoalService.getTeamGoal(user.id),
    ])

    const aggregatesByUser = new Map(reportAggregates.map((row) => [row.userId, row]))

    const employees = employeesPage.map((employee) => {
      const row = aggregatesByUser.get(employee.id)
      const zoomBooked = row?._sum.zoomAppointments ?? 0
      const zoom1Held = row?._sum.pzmConducted ?? 0
      const zoom2Held = row?._sum.vzmConducted ?? 0
      const contractReviewCount = row?._sum.contractReviewCount ?? 0
      const pushCount = row?._sum.pushCount ?? 0
      const successfulDeals = row?._sum.successfulDeals ?? 0
      const monthlySalesAmount = toMoneyString(row?._sum.monthlySalesAmount ?? 0)
      const reportsCount = row?._count._all ?? 0

      const conversions = computeConversions(
        {
          zoomBooked,
          zoom1Held,
          zoom2Held,
          contractReview: contractReviewCount,
          push: pushCount,
          deals: successfulDeals,
        },
        { benchmarks: settings.conversionBenchmarks }
      )

      return {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        isActive: employee.isActive,
        monthlyGoal: employee.monthlyGoal === null ? null : toMoneyString(employee.monthlyGoal),
        metrics: {
          zoomBooked,
          pzmConducted: zoom1Held,
          vzmConducted: zoom2Held,
          contractReviewCount,
          pushCount,
          successfulDeals,
          monthlySalesAmount,
          reportsCount,
        },
        funnel: conversions.stages.map((stage) => ({
          id: stage.id,
          stage: getStageLabel(stage.id),
          value: stage.value,
          conversion: stage.conversion,
        })),
      }
    })

    const totals = reportAggregates.reduce(
      (acc, row) => {
        acc.zoomBooked += row._sum.zoomAppointments ?? 0
        acc.zoom1Held += row._sum.pzmConducted ?? 0
        acc.zoom2Held += row._sum.vzmConducted ?? 0
        acc.contractReviewCount += row._sum.contractReviewCount ?? 0
        acc.pushCount += row._sum.pushCount ?? 0
        acc.successfulDeals += row._sum.successfulDeals ?? 0
        acc.monthlySalesAmount = acc.monthlySalesAmount.plus(toDecimal(row._sum.monthlySalesAmount ?? 0))
        return acc
      },
      {
        zoomBooked: 0,
        zoom1Held: 0,
        zoom2Held: 0,
        contractReviewCount: 0,
        pushCount: 0,
        successfulDeals: 0,
        monthlySalesAmount: toDecimal(0),
      }
    )

    const totalGoalDecimal = (() => {
      if (requestedManagerId || isAdmin) {
        const goals = employeesAll.map((employee) => employee.monthlyGoal)
        return sumDecimals(goals)
      }
      if (managerGoal !== null) {
        return toDecimal(managerGoal)
      }
      return sumDecimals(employeesAll.map((employee) => employee.monthlyGoal))
    })()

    const totalGoal = toMoneyString(totalGoalDecimal)
    const monthlySalesAmount = toMoneyString(totals.monthlySalesAmount)
    const goalProgress = totalGoalDecimal.greaterThan(0)
      ? roundPercent(calcPercent(totals.monthlySalesAmount, totalGoalDecimal))
      : 0

    const teamConversions = computeConversions(
      {
        zoomBooked: totals.zoomBooked,
        zoom1Held: totals.zoom1Held,
        zoom2Held: totals.zoom2Held,
        contractReview: totals.contractReviewCount,
        push: totals.pushCount,
        deals: totals.successfulDeals,
      },
      { benchmarks: settings.conversionBenchmarks }
    )

    const teamFunnel = teamConversions.stages.map((stage) => ({
      id: stage.id,
      stage: getStageLabel(stage.id),
      value: stage.value,
      conversion: stage.conversion,
      benchmark: stage.benchmark,
    }))

    const trend = trendAggregates.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      sales: Number(roundMoney(toDecimal(row._sum.monthlySalesAmount ?? 0)).toFixed(2)),
      deals: row._sum.successfulDeals ?? 0,
      pzm: row._sum.pzmConducted ?? 0,
      vzm: row._sum.vzmConducted ?? 0,
    }))

    const formattedDeals = deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      budget: toMoneyString(deal.budget),
      status: deal.status,
      paymentStatus: deal.paymentStatus,
      isFocus: deal.isFocus,
      managerId: deal.managerId,
      managerName: deal.manager?.name ?? null,
    }))

    const formattedAlerts = alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      userId: alert.userId,
      userName: alert.user?.name ?? null,
      isRead: alert.isRead,
      createdAt: alert.createdAt.toISOString(),
    }))

    return jsonWithPrivateCache(
      {
        employees,
        teamTotals: {
          zoomBooked: totals.zoomBooked,
          pzmConducted: totals.zoom1Held,
          vzmConducted: totals.zoom2Held,
          contractReviewCount: totals.contractReviewCount,
          pushCount: totals.pushCount,
          successfulDeals: totals.successfulDeals,
          monthlySalesAmount,
          totalGoal,
          goalProgress,
        },
        funnel: teamFunnel,
        alerts: formattedAlerts,
        deals: formattedDeals,
        pagination: {
          page,
          limit,
          total: totalEmployees,
          hasMore: page * limit < totalEmployees,
        },
        trend,
        motivation: motivation.summary,
        motivationGrades: motivation.grades,
        settings: {
          conversionBenchmarks: settings.conversionBenchmarks,
          alertThresholds: settings.alertThresholds,
          activityTarget: settings.activityTarget,
          northStarTarget: settings.northStarTarget,
          salesPerDeal: settings.salesPerDeal,
        },
      },
      {},
      15
    )
  } catch (error) {
    logError('GET /api/dashboard error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Manager access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
