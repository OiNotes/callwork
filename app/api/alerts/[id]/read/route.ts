import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { csrfError, validateOrigin } from '@/lib/csrf'
import { logError } from '@/lib/logger'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const user = await requireAuth()
    const { id } = await context.params
    const idResult = z.string().cuid().safeParse(id)
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid alert id' }, { status: 400 })
    }

    const alert = await prisma.alert.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    if (alert.userId) {
      if (user.role === 'EMPLOYEE' && alert.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (user.role === 'MANAGER') {
        const teamMember = await prisma.user.findFirst({
          where: {
            id: alert.userId,
            isActive: true,
            OR: [{ managerId: user.id }, { id: user.id }],
          },
          select: { id: true },
        })
        if (!teamMember) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    } else if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: { isRead: true },
    })

    return NextResponse.json({ alert: updated })

  } catch (error) {
    logError('Alert mark read error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
