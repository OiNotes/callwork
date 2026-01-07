import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireManager } from '@/lib/auth/get-session'
import { GoalAdminService } from '@/lib/services/GoalAdminService'
import { buildPagination } from '@/lib/utils/pagination'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  userId: z.string().cuid().optional(),
})

export async function GET(request: Request) {
  try {
    const manager = await requireManager()
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const page = parsed.data.page ?? 1
    const limit = parsed.data.limit ?? 50
    const result = await GoalAdminService.getGoalHistory(manager.id, {
      page,
      limit,
      userId: parsed.data.userId,
    })

    return NextResponse.json({
      data: result.items,
      pagination: buildPagination(page, limit, result.total),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
