import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'
import { requireManager } from '@/lib/auth/get-session'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { passwordSchema } from '@/lib/validators/auth'

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  name: z.string().min(2).max(100),
})

export async function POST(req: Request) {
  if (!validateOrigin(req)) {
    return csrfError()
  }

  // Rate limiting: 5 попыток в минуту по IP
  const rateLimitResult = await checkRateLimit(`register:${getClientIP(req)}`, 'register')
  if (!rateLimitResult.success) return rateLimitResponse(rateLimitResult)

  try {
    const manager = await requireManager()
    const body = await req.json()
    const { email, password, name } = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'EMPLOYEE',
        managerId: manager.id,
      },
    })

    await AuditLogService.log({
      action: AuditAction.USER_CREATE,
      userId: manager.id,
      targetUserId: user.id,
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent'),
      metadata: { role: user.role, email: user.email },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Manager access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
