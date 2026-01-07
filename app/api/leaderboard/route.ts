import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { roundMoney, toDecimal, toNumber } from '@/lib/utils/decimal'
import { z } from 'zod'
import { buildPagination } from '@/lib/utils/pagination'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const periodSchema = z.enum(['day', 'week', 'month'])
    const querySchema = z.object({
      period: periodSchema.optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      period: searchParams.get('period') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }

    const periodResult = periodSchema.safeParse(parsedQuery.data.period ?? 'month')
    if (!periodResult.success) {
      return NextResponse.json({ error: periodResult.error.issues }, { status: 400 })
    }
    const period = periodResult.data // day, week, month
    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const offset = (page - 1) * limit

    // Определить период
    const { startDate, endDate } = getPeriodDates(period)

    const baseWhere = user.role === 'MANAGER'
      ? { isActive: true, role: 'EMPLOYEE' as const, managerId: user.id }
      : user.role === 'ADMIN'
        ? { isActive: true, role: 'EMPLOYEE' as const }
        : { isActive: true, role: 'EMPLOYEE' as const, id: user.id }

    const scopeFilter = user.role === 'MANAGER'
      ? Prisma.sql`AND u."managerId" = ${user.id}`
      : user.role === 'ADMIN'
        ? Prisma.empty
        : Prisma.sql`AND u.id = ${user.id}`

    const [totalEmployees, leaderboardRows, totalsRows] = await Promise.all([
      prisma.user.count({ where: baseWhere }),
      prisma.$queryRaw<Array<{
        id: string
        name: string
        sales: unknown
        deals: unknown
        zoom: unknown
        pzm: unknown
        vzm: unknown
        goal: unknown
      }>>(Prisma.sql`
        SELECT
          u.id,
          u.name,
          COALESCE(SUM(r."monthlySalesAmount"), 0) AS sales,
          COALESCE(SUM(r."successfulDeals"), 0) AS deals,
          COALESCE(SUM(r."zoomAppointments"), 0) AS zoom,
          COALESCE(SUM(r."pzmConducted"), 0) AS pzm,
          COALESCE(SUM(r."vzmConducted"), 0) AS vzm,
          u."monthlyGoal" AS goal
        FROM "User" u
        LEFT JOIN "Report" r ON r."userId" = u.id
          AND r.date >= ${startDate}
          AND r.date <= ${endDate}
        WHERE u."isActive" = true
          AND u.role = 'EMPLOYEE'
          ${scopeFilter}
        GROUP BY u.id, u.name, u."monthlyGoal"
        ORDER BY sales DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `),
      prisma.$queryRaw<Array<{ totalSales: unknown; totalDeals: unknown }>>(Prisma.sql`
        SELECT
          COALESCE(SUM(r."monthlySalesAmount"), 0) AS "totalSales",
          COALESCE(SUM(r."successfulDeals"), 0) AS "totalDeals"
        FROM "User" u
        LEFT JOIN "Report" r ON r."userId" = u.id
          AND r.date >= ${startDate}
          AND r.date <= ${endDate}
        WHERE u."isActive" = true
          AND u.role = 'EMPLOYEE'
          ${scopeFilter}
      `),
    ])

    // Рассчитать статистику для лидерборда
    const leaderboard = leaderboardRows.map((row, index) => {
      const deals = Number(row.deals ?? 0)
      const zoom = Number(row.zoom ?? 0)
      const pzm = Number(row.pzm ?? 0)
      const vzm = Number(row.vzm ?? 0)
      const sales = toNumber(roundMoney(toDecimal(row.sales)))
      const goalValue = row.goal === null || row.goal === undefined ? null : toNumber(toDecimal(row.goal))

      const avgCheck = deals > 0
        ? toNumber(toDecimal(sales).dividedBy(deals).toDecimalPlaces(0))
        : 0
      const goalProgress = goalValue && goalValue > 0
        ? toNumber(toDecimal(sales).dividedBy(goalValue).times(100).toDecimalPlaces(0))
        : null
      const finalConversion = vzm > 0 ? Math.round((deals / vzm) * 100) : 0

      return {
        id: row.id,
        name: row.name,
        deals,
        sales,
        avgCheck,
        goalProgress,
        finalConversion,
        activities: {
          zoom,
          pzm,
          vzm,
        },
        rank: offset + index + 1,
        medal: offset + index === 0
          ? 'gold'
          : offset + index === 1
            ? 'silver'
            : offset + index === 2
              ? 'bronze'
              : undefined,
      }
    })

    const totals = totalsRows[0] ?? { totalSales: 0, totalDeals: 0 }
    const totalSales = toNumber(roundMoney(toDecimal(totals.totalSales)))
    const totalDeals = Number(totals.totalDeals ?? 0)

    return jsonWithPrivateCache({
      data: leaderboard,
      pagination: buildPagination(page, limit, totalEmployees),
      period: { start: startDate, end: endDate, type: period },
      stats: {
        totalEmployees,
        totalSales,
        totalDeals,
      }
    })

  } catch (error) {
    logError('Leaderboard API error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Утилита для определения дат периода
function getPeriodDates(period: string) {
  const now = new Date()
  let startDate: Date
  const endDate: Date = new Date() // Сегодня

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      startDate = new Date(now)
      startDate.setDate(now.getDate() + mondayOffset)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }

  return { startDate, endDate }
}
