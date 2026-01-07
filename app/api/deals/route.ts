import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { resolveAccessibleManagerIds } from '@/lib/motivation/scope'
import { DealStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { buildPagination } from '@/lib/utils/pagination'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const managerIdSchema = z.union([z.literal('all'), z.string().cuid()])
    const querySchema = z.object({
      managerId: managerIdSchema.optional(),
      status: z.nativeEnum(DealStatus).optional(),
      focusOnly: z.preprocess(
        (value) => (value === 'true' ? true : value === 'false' ? false : value),
        z.boolean()
      ).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      managerId: searchParams.get('managerId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      focusOnly: searchParams.get('focusOnly') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const { managerId, status, focusOnly } = parsedQuery.data
    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const skip = (page - 1) * limit

    const managerIds = await resolveAccessibleManagerIds(user, managerId ?? null)

    const where: Prisma.DealWhereInput = {
      managerId: { in: managerIds },
      ...(focusOnly ? { isFocus: true } : {}),
    }

    if (status) {
      where.status = status
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          budget: true,
          status: true,
          paymentStatus: true,
          isFocus: true,
          updatedAt: true,
        },
      }),
      prisma.deal.count({ where }),
    ])

    return jsonWithPrivateCache({
      data: deals,
      pagination: buildPagination(page, limit, total),
    })
  } catch (error) {
    logError('GET /api/deals error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
