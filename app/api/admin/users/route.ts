import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { passwordSchema } from '@/lib/validators/auth'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { getClientIP } from '@/lib/rate-limit'
import { buildPagination } from '@/lib/utils/pagination'
import { csrfError, validateOrigin } from '@/lib/csrf'

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  role: z.enum(['EMPLOYEE', 'MANAGER']).default('EMPLOYEE'),
  password: passwordSchema,
})

export async function GET(request: Request) {
  try {
    const manager = await requireManager()
    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
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

    const whereClause =
      manager.role === 'ADMIN'
        ? {}
        : {
            OR: [{ id: manager.id }, { managerId: manager.id }],
          }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          managerId: true,
          telegramId: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.user.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: users,
      pagination: buildPagination(page, limit, total),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const manager = await requireManager()
    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const { name, email, role, password } = parsed.data

    if (role === 'MANAGER' && manager.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Только администратор может создавать менеджеров' },
        { status: 403 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        password: hashedPassword,
        managerId: role === 'EMPLOYEE' ? manager.id : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    await AuditLogService.log({
      action: AuditAction.USER_CREATE,
      userId: manager.id,
      targetUserId: user.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      metadata: { role: user.role, email: user.email },
    })

    return NextResponse.json({ user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
