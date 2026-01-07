import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { MotivationCalculatorService } from '@/lib/services/MotivationCalculatorService'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

const service = new MotivationCalculatorService()

export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      userId: z.string().cuid().optional(),
    })
    const parsedQuery = querySchema.safeParse({
      userId: searchParams.get('userId') ?? undefined,
    })
    if (!parsedQuery.success) {
      return new NextResponse('Invalid request', { status: 400 })
    }
    const requestedUserId = parsedQuery.data.userId

    let targetUserId = user.id

    // Allow managers/admins to view other users' data
    if (requestedUserId) {
      if (user.role === 'MANAGER') {
        const targetUser = await prisma.user.findFirst({
          where: {
            id: requestedUserId,
            isActive: true,
            OR: [{ managerId: user.id }, { id: user.id }],
          },
          select: { id: true },
        })
        if (!targetUser) {
          return new NextResponse('Forbidden', { status: 403 })
        }
        targetUserId = requestedUserId
      } else if (user.role === 'ADMIN') {
        const targetUser = await prisma.user.findFirst({
          where: { id: requestedUserId, isActive: true },
          select: { id: true },
        })
        if (!targetUser) {
          return new NextResponse('Forbidden', { status: 403 })
        }
        targetUserId = requestedUserId
      } else if (requestedUserId !== user.id) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const data = await service.calculateIncomeForecast(targetUserId)
    return jsonWithPrivateCache(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    logError('Income forecast error', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
