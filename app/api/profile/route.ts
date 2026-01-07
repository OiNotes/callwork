import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { passwordSchema } from '@/lib/validators/auth'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'
import { jsonWithPrivateCache } from '@/lib/utils/http'

const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().max(255).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordSchema.optional(),
    unlinkTelegram: z.boolean().optional(),
  })
  .strict()

export async function GET() {
  try {
    const sessionUser = await requireAuth()
    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        telegramId: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return jsonWithPrivateCache({ user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const sessionUser = await requireAuth()
    const body = await request.json()
    const parsed = updateProfileSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        telegramId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { name, email, currentPassword, newPassword, unlinkTelegram } = parsed.data

    if (newPassword && !currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    const updateData: {
      name?: string
      email?: string
      password?: string
      telegramId?: string | null
      telegramCode?: string | null
      codeExpiresAt?: Date | null
    } = {}

    if (name && name !== user.name) updateData.name = name
    if (email && email !== user.email) updateData.email = email

    if (newPassword) {
      const isPasswordValid = await bcrypt.compare(currentPassword ?? '', user.password)
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Invalid current password' }, { status: 400 })
      }
      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    if (unlinkTelegram) {
      updateData.telegramId = null
      updateData.telegramCode = null
      updateData.codeExpiresAt = null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes applied' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        telegramId: true,
        lastLoginAt: true,
      },
    })

    const updatedFields = Object.keys(updateData).filter((field) => field !== 'password')

    if (updatedFields.length > 0) {
      await AuditLogService.log({
        action: AuditAction.USER_UPDATE,
        userId: user.id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
        metadata: { updatedFields },
      })
    }

    if (newPassword) {
      await AuditLogService.log({
        action: AuditAction.PASSWORD_CHANGE,
        userId: user.id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
      })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
