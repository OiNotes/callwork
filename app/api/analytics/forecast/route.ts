import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { calculateMonthlyForecast, generateForecastChartData } from '@/lib/calculations/forecast'
import { GoalService } from '@/lib/services/GoalService'
import { roundMoney, sumDecimals, toDecimal, toNumber } from '@/lib/utils/decimal'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

/**
 * GET /api/analytics/forecast
 * 
 * Query params:
 * - userId: string (опционально, для менеджеров - смотреть прогноз сотрудника)
 * - month: string (опционально, формат: YYYY-MM, по умолчанию текущий месяц)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth()

    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      userId: z.string().cuid().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      userId: searchParams.get('userId') ?? undefined,
      month: searchParams.get('month') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const { userId: userIdParam, month: monthParam } = parsedQuery.data

    // Определить пользователя для анализа
    let targetUserId = currentUser.id
    
    if (userIdParam) {
      if (currentUser.role !== 'MANAGER' && currentUser.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: only managers can view other users\' forecasts' },
          { status: 403 }
        )
      }
      if (currentUser.role === 'MANAGER') {
        const targetUser = await prisma.user.findFirst({
          where: {
            id: userIdParam,
            isActive: true,
            OR: [{ managerId: currentUser.id }, { id: currentUser.id }],
          },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden: Cannot access other users\' forecasts' }, { status: 403 })
        }
        targetUserId = userIdParam
      } else {
        const targetUser = await prisma.user.findFirst({
          where: { id: userIdParam, isActive: true },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden: Cannot access other users\' forecasts' }, { status: 403 })
        }
        targetUserId = userIdParam
      }
    }

    // Получить данные пользователя
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Получить цель через единый сервис
    const monthlyGoal = await GoalService.getUserGoal(targetUserId)

    // Если нет цели - вернуть ошибку
    if (monthlyGoal === null) {
      return jsonWithPrivateCache({
        goalMissing: true,
        current: 0,
        projected: 0,
        progress: 0,
        message: 'Установите месячную цель в настройках'
      })
    }

    // Определить период (текущий месяц или указанный)
    let startDate: Date
    let endDate: Date

    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number)
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59)
    } else {
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }

    // Получить отчёты за период
    const reports = await prisma.report.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        date: true,
        monthlySalesAmount: true,
        successfulDeals: true
      },
      orderBy: { date: 'asc' }
    })

    // Рассчитать текущую сумму продаж
    const currentSales = toNumber(roundMoney(sumDecimals(reports.map((r) => r.monthlySalesAmount))))

    // Рассчитать прогноз
    const forecast = calculateMonthlyForecast(currentSales, monthlyGoal)

    // Подготовить данные по дням для графика
    const dailySales = reports.map(report => ({
      day: report.date.getDate(),
      sales: toNumber(toDecimal(report.monthlySalesAmount))
    }))

    const chartData = generateForecastChartData(currentSales, monthlyGoal, dailySales)

    return jsonWithPrivateCache({
      user: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        isCurrentMonth: !monthParam
      },
      forecast,
      chartData
    })

  } catch (error) {
    logError('Forecast API error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
