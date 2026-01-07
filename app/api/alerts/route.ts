import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { AlertSeverity, Prisma } from '@prisma/client'
import { z } from 'zod'
import { buildPagination } from '@/lib/utils/pagination'
import { csrfError, validateOrigin } from '@/lib/csrf'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      severity: z.nativeEnum(AlertSeverity).optional(),
      isRead: z.enum(['true', 'false']).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      severity: searchParams.get('severity') ?? undefined,
      isRead: searchParams.get('isRead') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const { severity, isRead } = parsedQuery.data
    const page = parsedQuery.data.page ?? 1
    const limit = parsedQuery.data.limit ?? 50
    const skip = (page - 1) * limit

    const isAdmin = user.role === 'ADMIN'
    const isManager = user.role === 'MANAGER'

    const teamUserIds =
      isManager
        ? await prisma.user
            .findMany({
              where: { OR: [{ id: user.id }, { managerId: user.id }], isActive: true },
              select: { id: true },
            })
            .then((rows) => rows.map((row) => row.id))
        : null

    // Менеджеры видят алерты своей команды, сотрудники только свои
    const baseWhere: Prisma.AlertWhereInput =
      isAdmin
        ? {}
        : isManager
          ? { OR: [{ userId: null }, { userId: { in: teamUserIds ?? [] } }] }
          : { userId: user.id }

    const alertsWhere: Prisma.AlertWhereInput = { ...baseWhere }

    if (severity) {
      alertsWhere.severity = severity
    }

    if (isRead !== undefined) {
      alertsWhere.isRead = isRead === 'true'
    }

    const [alerts, total, unreadCount] = await prisma.$transaction([
      prisma.alert.findMany({
        where: alertsWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.alert.count({ where: alertsWhere }),
      prisma.alert.count({
        where: {
          ...baseWhere,
          isRead: false
        }
      }),
    ])

    return jsonWithPrivateCache({
      data: alerts,
      pagination: buildPagination(page, limit, total),
      unreadCount,
    })

  } catch (error) {
    logError('Alerts GET error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const user = await requireAuth()

    const isAdmin = user.role === 'ADMIN'
    const isManager = user.role === 'MANAGER'

    const teamUserIds =
      isManager
        ? await prisma.user
            .findMany({
              where: { OR: [{ id: user.id }, { managerId: user.id }], isActive: true },
              select: { id: true },
            })
            .then((rows) => rows.map((row) => row.id))
        : null

    const result = await prisma.alert.updateMany({
      where: {
        ...(isAdmin
          ? {}
          : isManager
            ? { OR: [{ userId: null }, { userId: { in: teamUserIds ?? [] } }] }
            : { userId: user.id }),
        isRead: false
      },
      data: { isRead: true }
    })

    return NextResponse.json({ updated: result.count })

  } catch (error) {
    logError('Mark all read error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
