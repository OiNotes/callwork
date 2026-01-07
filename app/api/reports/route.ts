import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import DecimalJS from 'decimal.js'
import { broadcastDeal } from '../sse/deals/route'
import { broadcastActivity } from '../sse/activities/route'
import { buildPagination } from '@/lib/utils/pagination'
import { csrfError, validateOrigin } from '@/lib/csrf'
import { toDecimal, toNumber } from '@/lib/utils/decimal'
import { jsonWithPrivateCache } from '@/lib/utils/http'

const MAX_COUNT = 10000
const MAX_SALES_AMOUNT = 1_000_000_000
const MAX_REASON_LENGTH = 500
const MAX_COMMENT_LENGTH = 1000

const parseDecimalString = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return value
  return String(value)
}

const moneySchema = z.preprocess(
  (value) => parseDecimalString(value),
  z.string().refine((value) => {
    try {
      const decimal = new DecimalJS(value)
      return decimal.isFinite() && decimal.greaterThanOrEqualTo(0) && decimal.lessThanOrEqualTo(MAX_SALES_AMOUNT)
    } catch {
      return false
    }
  }, { message: 'Invalid money amount' })
)

const createReportSchema = z.object({
  date: z.string().datetime(),
  zoomAppointments: z.number().int().min(0).max(MAX_COUNT),
  pzmConducted: z.number().int().min(0).max(MAX_COUNT),
  refusalsCount: z.number().int().min(0).max(MAX_COUNT),
  refusalsReasons: z.string().trim().max(MAX_REASON_LENGTH).optional(),
  refusalsByStage: z
    .object({
      zoomBooked: z.number().int().min(0).max(MAX_COUNT).optional(),
      zoom1Held: z.number().int().min(0).max(MAX_COUNT).optional(),
      zoom2Held: z.number().int().min(0).max(MAX_COUNT).optional(),
      contractReview: z.number().int().min(0).max(MAX_COUNT).optional(),
      push: z.number().int().min(0).max(MAX_COUNT).optional(),
    })
    .strict()
    .optional(),
  warmingUpCount: z.number().int().min(0).max(MAX_COUNT),
  vzmConducted: z.number().int().min(0).max(MAX_COUNT),
  contractReviewCount: z.number().int().min(0).max(MAX_COUNT),
  pushCount: z.number().int().min(0).max(MAX_COUNT),
  successfulDeals: z.number().int().min(0).max(MAX_COUNT),
  monthlySalesAmount: moneySchema,
  comment: z.string().trim().max(MAX_COMMENT_LENGTH).optional(),
}).refine(
  (data) => {
    // Валидация воронки: каждый следующий этап не может превышать предыдущий
    // zoomAppointments (booked) >= pzmConducted (zoom1) >= vzmConducted (zoom2)
    // >= contractReviewCount >= pushCount >= successfulDeals
    if (data.pzmConducted > data.zoomAppointments) return false
    if (data.vzmConducted > data.pzmConducted) return false
    if (data.contractReviewCount > data.vzmConducted) return false
    if (data.pushCount > data.contractReviewCount) return false
    if (data.successfulDeals > data.pushCount) return false
    return true
  },
  {
    message: 'Funnel validation failed: each stage cannot exceed the previous stage',
  }
)

export async function GET(req: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    
    const querySchema = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      userId: z.string().cuid().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const { startDate, endDate, userId } = parsedQuery.data
    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const skip = (page - 1) * limit

    let targetUserId = user.id
    if (userId) {
      if (user.role === 'MANAGER') {
        const targetUser = await prisma.user.findFirst({
          where: {
            id: userId,
            isActive: true,
            OR: [{ managerId: user.id }, { id: user.id }],
          },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        targetUserId = userId
      } else if (user.role === 'ADMIN') {
        const targetUser = await prisma.user.findFirst({
          where: { id: userId, isActive: true },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        targetUserId = userId
      } else if (userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: {
          userId: targetUserId,
          ...(startDate && endDate && {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        },
        orderBy: {
          date: 'desc',
        },
        take: limit,
        skip,
      }),
      prisma.report.count({
        where: {
          userId: targetUserId,
          ...(startDate && endDate && {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        },
      }),
    ])

    return jsonWithPrivateCache({
      data: reports,
      pagination: buildPagination(page, limit, total),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!validateOrigin(req)) {
    return csrfError()
  }

  try {
    const user = await requireAuth()
    const body = await req.json()
    
    const data = createReportSchema.parse(body)

    // Используем транзакцию для атомарной проверки и создания
    // Предотвращает race condition между проверкой и созданием
    const reportDate = new Date(data.date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (reportDate > today) {
      return NextResponse.json(
        { error: 'Нельзя создавать отчёты на будущие даты' },
        { status: 400 }
      )
    }
    const salesAmountString = toDecimal(data.monthlySalesAmount).toString()
    const salesAmountNumber = toNumber(toDecimal(salesAmountString))

    const report = await prisma.$transaction(async (tx) => {
      // Проверяем существование внутри транзакции
      const existingReport = await tx.report.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: reportDate,
          },
        },
      })

      if (existingReport) {
        throw new Error('REPORT_EXISTS')
      }

      return tx.report.create({
        data: {
          userId: user.id,
          date: reportDate,
          zoomAppointments: data.zoomAppointments,
          pzmConducted: data.pzmConducted,
          refusalsCount: data.refusalsCount,
          refusalsReasons: data.refusalsReasons,
          refusalsByStage: data.refusalsByStage || undefined,
          warmingUpCount: data.warmingUpCount,
          vzmConducted: data.vzmConducted,
          contractReviewCount: data.contractReviewCount,
          pushCount: data.pushCount,
          successfulDeals: data.successfulDeals,
          monthlySalesAmount: salesAmountString,
          comment: data.comment,
        },
      })
    })

    // Broadcast сделки в реальном времени если есть успешные сделки
    if (data.successfulDeals > 0) {
      broadcastDeal({
        employeeId: user.id,
        employeeName: user.name,
        amount: salesAmountNumber,
        dealsCount: data.successfulDeals
      })
    }

    // Broadcast активности
    broadcastActivity({
      type: data.successfulDeals > 0 ? 'deal' : 'report',
      message: data.successfulDeals > 0
        ? `${user.name} закрыл ${data.successfulDeals} ${pluralizeDeal(data.successfulDeals)}`
        : `${user.name} отправил отчёт`,
      details: data.successfulDeals > 0
        ? `Сумма: ${formatMoney(salesAmountNumber)}₽`
        : `Zoom: ${data.zoomAppointments}, ПЗМ: ${data.pzmConducted}`,
      userId: user.id,
      userName: user.name
    })

    return NextResponse.json({ report })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues },
        { status: 400 }
      )
    }

    // Обработка ошибки дубликата отчёта из транзакции
    if (error instanceof Error && error.message === 'REPORT_EXISTS') {
      return NextResponse.json(
        { error: 'Report for this date already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function pluralizeDeal(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'сделку'
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'сделки'
  return 'сделок'
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}
