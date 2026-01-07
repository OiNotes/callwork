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
    const body = await request.json()
    const bodySchema = z.object({
      isFocus: z.boolean(),
    })
    const parsedBody = bodySchema.safeParse(body)
    if (!parsedBody.success) {
      return new NextResponse('Invalid request body', { status: 400 })
    }
    const { isFocus } = parsedBody.data
    const { id } = await context.params
    const idResult = z.string().cuid().safeParse(id)
    if (!idResult.success) {
      return new NextResponse('Invalid deal id', { status: 400 })
    }

    // 1. Check permissions
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { manager: true }
    })

    if (!deal) {
      return new NextResponse('Deal not found', { status: 404 })
    }

    // Allow if:
    // - User is the deal owner
    // - User is a MANAGER and deal belongs to their team member
    const isOwner = deal.managerId === user.id

    const isAdmin = user.role === 'ADMIN'
    let hasTeamAccess = false
    if (user.role === 'MANAGER' && !isOwner) {
      // Проверяем что владелец сделки - сотрудник этого менеджера
      const dealOwner = await prisma.user.findFirst({
        where: { id: deal.managerId, isActive: true },
        select: { managerId: true }
      })
      hasTeamAccess = dealOwner?.managerId === user.id
    }

    if (!isOwner && !hasTeamAccess && !isAdmin) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // 2. Update
    const updatedDeal = await prisma.deal.update({
      where: { id },
      data: { isFocus: Boolean(isFocus) }
    })

    return NextResponse.json(updatedDeal)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    logError('Error updating deal focus', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
