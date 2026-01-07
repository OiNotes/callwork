import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireManager } from '@/lib/auth/get-session'
import { buildPagination } from '@/lib/utils/pagination'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export async function GET(request: Request) {
  try {
    const manager = await requireManager()
    const { searchParams } = new URL(request.url)
    const parsedQuery = querySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }

    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const skip = (page - 1) * limit

    const teamUsers = await prisma.user.findMany({
      where: {
        OR: [{ id: manager.id }, { managerId: manager.id }],
      },
      select: { id: true },
    })
    const teamUserIds = teamUsers.map((user) => user.id)

    const whereClause = {
      OR: [
        { userId: { in: teamUserIds } },
        { targetUserId: { in: teamUserIds } },
      ],
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          action: true,
          userId: true,
          targetUserId: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: logs,
      pagination: buildPagination(page, limit, total),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
