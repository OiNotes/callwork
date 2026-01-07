import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireManager } from '@/lib/auth/get-session'
import { calculateConversions } from '@/lib/analytics/conversions'
import { calculateManagerStats } from '@/lib/analytics/funnel'
import { getSettingsForUser } from '@/lib/settings/context'
import { GoalService } from '@/lib/services/GoalService'
import { z } from 'zod'
import { buildPagination } from '@/lib/utils/pagination'
import type { Prisma, Role } from '@prisma/client'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(request: Request) {
  try {
    const manager = await requireManager()
    const { searchParams } = new URL(request.url)

    const querySchema = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }

    const startDate = parsedQuery.data.startDate
      ? new Date(parsedQuery.data.startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 1))
    const endDate = parsedQuery.data.endDate ? new Date(parsedQuery.data.endDate) : new Date()
    if (startDate > endDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const { settings } = await getSettingsForUser(manager.id, manager.role)
    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const skip = (page - 1) * limit
    
    const isAdmin = manager.role === 'ADMIN'

    const employeesWhere: Prisma.UserWhereInput = isAdmin
      ? {
          role: 'EMPLOYEE' as Role,
          isActive: true,
        }
      : {
          managerId: manager.id,
          role: 'EMPLOYEE' as Role,
          isActive: true,
        }

    const [employees, totalEmployees, allEmployeeIds] = await Promise.all([
      prisma.user.findMany({
        where: employeesWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          reports: {
            where: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { date: 'desc' },
            select: {
              id: true,
              date: true,
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
          },
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: employeesWhere }),
      prisma.user.findMany({
        where: employeesWhere,
        select: { id: true },
      }),
    ])
    const employeeGoals = await GoalService.getUsersGoals(employees.map((e) => e.id))

    // --- РАСЧЕТ ОБЩЕЙ СТАТИСТИКИ КОМАНДЫ (Менеджер + Сотрудники) ---
    
    // 1. Получаем отчеты всей команды (включая менеджера) для корректного факта
    const teamUserIds = isAdmin
      ? allEmployeeIds.map((e) => e.id)
      : [manager.id, ...allEmployeeIds.map((e) => e.id)]
    const allTeamReports = await prisma.report.findMany({
      where: {
        userId: { in: teamUserIds },
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    // 2. Считаем статистику по всем отчетам
    const teamStatsRaw = await calculateManagerStats(allTeamReports, manager.id, {
      salesPerDeal: settings.salesPerDeal,
      planMode: 'team',
    })
    
    // 3. Добавляем расчеты конверсий для команды
    const teamConversions = calculateConversions(
      {
        zoomBooked: teamStatsRaw.zoomBooked,
        zoom1Held: teamStatsRaw.zoom1Held,
        zoom2Held: teamStatsRaw.zoom2Held,
        contractReview: teamStatsRaw.contractReview,
        pushCount: teamStatsRaw.pushCount,
        successfulDeals: teamStatsRaw.successfulDeals,
        monthlySalesAmount: teamStatsRaw.salesAmount,
      },
      settings.conversionBenchmarks
    )

    const teamStats = {
      ...teamStatsRaw,
      // Гарантируем что план берется из GoalService (уже внутри calculateManagerStats, но явно для надежности)
      planSales: teamStatsRaw.planSales, 
      planDeals: teamStatsRaw.planDeals,
      bookedToZoom1: teamConversions.bookedToZoom1,
      zoom1ToZoom2: teamConversions.zoom1ToZoom2,
      zoom2ToContract: teamConversions.zoom2ToContract,
      contractToPush: teamConversions.contractToPush,
      pushToDeal: teamConversions.pushToDeal,
      northStar: teamConversions.northStar,
    }
    
    // ----------------------------------------------------------------

    // Для каждого работника посчитать статистику
    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        const stats = await calculateManagerStats(employee.reports, employee.id, {
          salesPerDeal: settings.salesPerDeal,
          planMode: 'user',
          planSalesOverride: employeeGoals[employee.id] ?? 0,
        })
        const conversions = calculateConversions(
          {
            zoomBooked: stats.zoomBooked,
            zoom1Held: stats.zoom1Held,
            zoom2Held: stats.zoom2Held,
            contractReview: stats.contractReview,
            pushCount: stats.pushCount,
            successfulDeals: stats.successfulDeals,
            monthlySalesAmount: stats.salesAmount,
          },
          settings.conversionBenchmarks
        )

        return {
          ...employee,
          ...stats,
          planSales: stats.planSales,
          planDeals: stats.planDeals,
          hasRedZone:
            conversions.zoom1ToZoom2 < settings.conversionBenchmarks.ZOOM1_TO_ZOOM2 ||
            conversions.pushToDeal < settings.conversionBenchmarks.PUSH_TO_DEAL,
        }
      })
    )
    
    return jsonWithPrivateCache({ 
      data: employeesWithStats,
      pagination: buildPagination(page, limit, totalEmployees),
      teamStats,
      settings,
    })
  } catch (error) {
    logError('GET /api/employees error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Manager access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
