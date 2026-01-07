import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { getSettingsForUser } from '@/lib/settings/context'
import { roundMoney, toDecimal, toNumber } from '@/lib/utils/decimal'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(req: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    
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
    const { startDate, endDate, userId } = parsedQuery.data
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: 'Invalid period range' }, { status: 400 })
    }

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

    const whereClause: Prisma.ReportWhereInput = {
      userId: targetUserId,
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    }

    const [{ settings }, stats] = await Promise.all([
      getSettingsForUser(user.id, user.role),
      prisma.report.aggregate({
        where: whereClause,
        _sum: {
          zoomAppointments: true,
          pzmConducted: true,
          refusalsCount: true,
          warmingUpCount: true,
          vzmConducted: true,
          contractReviewCount: true,
          successfulDeals: true,
          monthlySalesAmount: true,
          pushCount: true,
        },
        _avg: {
          monthlySalesAmount: true,
        },
        _count: true,
      }),
    ])

    const totals = {
      zoomBooked: stats._sum.zoomAppointments || 0,
      zoom1Held: stats._sum.pzmConducted || 0,
      zoom2Held: stats._sum.vzmConducted || 0,
      contractReview: stats._sum.contractReviewCount || 0,
      push: (stats._sum.pushCount as number | null) ?? stats._sum.contractReviewCount ?? 0,
      deals: stats._sum.successfulDeals || 0,
      sales: toNumber(roundMoney(toDecimal(stats._sum.monthlySalesAmount || 0))),
      refusals: stats._sum.refusalsCount || 0,
      warming: stats._sum.warmingUpCount || 0,
    }

    const averages = {
      monthlySalesAmount: toNumber(roundMoney(toDecimal(stats._avg.monthlySalesAmount || 0))),
    }

    const fullFunnel = calculateFullFunnel(totals, {
      benchmarks: settings.conversionBenchmarks,
      northStarTarget: settings.northStarTarget,
    })

    const conversions = fullFunnel.funnel
      .filter((stage) => stage.id !== 'zoomBooked')
      .reduce<Record<string, number>>((acc, stage) => {
        acc[stage.id] = stage.conversion
        return acc
      }, {})

    return jsonWithPrivateCache({
      totals,
      averages,
      count: stats._count,
      conversions,
      northStar: fullFunnel.northStarKpi,
      sideFlow: fullFunnel.sideFlow,
    })
  } catch (error) {
    logError('Statistics API error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
