import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET() {
  try {
    const manager = await requireManager()

    const users = await prisma.user.findMany({
      where: {
        managerId: manager.id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramId: true,
        createdAt: true,
        _count: {
          select: { reports: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return jsonWithPrivateCache({ users })
  } catch {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
}
