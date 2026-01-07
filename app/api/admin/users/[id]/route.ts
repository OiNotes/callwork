import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { passwordSchema } from '@/lib/validators/auth'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'

const paramsSchema = z.object({
  id: z.string().cuid(),
})

const updateUserSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().max(255).optional(),
    role: z.enum(['EMPLOYEE', 'MANAGER']).optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .strict()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const manager = await requireManager()
    const { id } = await context.params
    const parsedParams = paramsSchema.safeParse({ id })
    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.issues }, { status: 400 })
    }

    const body = await request.json()
    const parsedBody = updateUserSchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 })
    }

    if (Object.keys(parsedBody.data).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const targetUser = await prisma.user.findFirst({
      where:
        manager.role === 'ADMIN'
          ? { id: parsedParams.data.id }
          : {
              id: parsedParams.data.id,
              OR: [{ id: manager.id }, { managerId: manager.id }],
            },
      select: {
        id: true,
        email: true,
        role: true,
        managerId: true,
        isActive: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { name, email, role, isActive, password } = parsedBody.data

    if (role === 'MANAGER' && manager.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Только администратор может назначать менеджеров' },
        { status: 403 }
      )
    }

    if (targetUser.id === manager.id) {
      if (role && role !== targetUser.role) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
      }
      if (isActive === false) {
        return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 403 })
      }
    }

    if (email && email !== targetUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      if (existingUser && existingUser.id !== targetUser.id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    const updateData: {
      name?: string
      email?: string
      role?: 'EMPLOYEE' | 'MANAGER'
      isActive?: boolean
      password?: string
      managerId?: string | null
    } = {}

    if (name) updateData.name = name
    if (email) updateData.email = email
    if (role) updateData.role = role
    if (typeof isActive === 'boolean') updateData.isActive = isActive

    if (role) {
      updateData.managerId = role === 'EMPLOYEE' ? manager.id : null
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: updateData,
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

    const updatedFields = Object.keys(updateData).filter((field) => field !== 'password')

    if (updatedFields.length > 0) {
      await AuditLogService.log({
        action: AuditAction.USER_UPDATE,
        userId: manager.id,
        targetUserId: targetUser.id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
        metadata: { updatedFields },
      })
    }

    if (password) {
      await AuditLogService.log({
        action: AuditAction.PASSWORD_CHANGE,
        userId: manager.id,
        targetUserId: targetUser.id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
      })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
