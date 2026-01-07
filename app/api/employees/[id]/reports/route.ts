import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/get-session'
import { toDecimal, toNumber } from '@/lib/utils/decimal'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: employeeId } = await context.params
    const idResult = z.string().cuid().safeParse(employeeId)
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 })
    }
    
    // Проверка прав
    if (user.role === 'EMPLOYEE' && user.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    if (user.role === 'MANAGER' && employeeId !== user.id) {
      const employee = await prisma.user.findFirst({
        where: { id: employeeId, isActive: true },
        select: { managerId: true }
      })
      
      if (!employee || employee.managerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    
    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }

    const limit = parsedQuery.data.limit ?? 10
    const offset = parsedQuery.data.offset ?? 0
    
    const reports = await prisma.report.findMany({
      where: {
        userId: employeeId
      },
      orderBy: {
        date: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userId: true,
        date: true,
        zoomAppointments: true,
        pzmConducted: true,
        vzmConducted: true,
        contractReviewCount: true,
        pushCount: true,
        successfulDeals: true,
        monthlySalesAmount: true,
        refusalsCount: true,
        refusalsByStage: true,
        warmingUpCount: true,
        comment: true,
      }
    }).then(reports =>
      reports.map(r => ({
        ...r,
        monthlySalesAmount: toNumber(toDecimal(r.monthlySalesAmount)), // Конвертируем Decimal в number
        date: r.date.toISOString() // Конвертируем Date в ISO string
      }))
    )

    const total = await prisma.report.count({
      where: {
        userId: employeeId
      }
    })

    return jsonWithPrivateCache({
      reports,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    logError('GET /api/employees/[id]/reports error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
