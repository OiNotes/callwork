import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { toDecimal, toNumber } from '@/lib/utils/decimal'
import { z } from 'zod'
import { buildPagination } from '@/lib/utils/pagination'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 20
    const skip = (page - 1) * limit

    const userIds =
      user.role === 'ADMIN'
        ? await prisma.user
            .findMany({
              where: { isActive: true },
              select: { id: true },
            })
            .then((rows) => rows.map((row) => row.id))
        : user.role === 'MANAGER'
          ? await prisma.user
              .findMany({
                where: {
                  OR: [{ id: user.id }, { managerId: user.id }],
                  isActive: true,
                },
                select: { id: true },
              })
              .then((rows) => rows.map((row) => row.id))
          : [user.id]

    // Получить последние отчёты
    const [recentReports, total] = await Promise.all([
      prisma.report.findMany({
        where: { userId: { in: userIds } },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.report.count({ where: { userId: { in: userIds } } }),
    ])

    // Преобразовать в активности
    const activities = recentReports.map(report => {
      const hasDeals = report.successfulDeals > 0
      
      return {
        id: report.id,
        type: hasDeals ? 'deal' : 'report',
        message: hasDeals
          ? `${report.user.name} закрыл ${report.successfulDeals} ${pluralize(report.successfulDeals, 'сделку', 'сделки', 'сделок')}`
          : `${report.user.name} отправил отчёт`,
        details: hasDeals
          ? `Сумма: ${formatMoney(toNumber(toDecimal(report.monthlySalesAmount)))}`
          : `Zoom: ${report.zoomAppointments}, ПЗМ: ${report.pzmConducted}`,
        timestamp: report.createdAt,
        userId: report.user.id,
        userName: report.user.name
      }
    })

    return jsonWithPrivateCache({
      data: activities,
      pagination: buildPagination(page, limit, total),
    })

  } catch (error) {
    logError('Activities API error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function pluralize(count: number, one: string, few: string, many: string) {
  if (count % 10 === 1 && count % 100 !== 11) return one
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return few
  return many
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}
