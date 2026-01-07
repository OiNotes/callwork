import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { getSettingsForUser } from '@/lib/settings/context'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const querySchema = z.object({
      managerId: z.string().cuid().optional(),
    })
    const parsedQuery = querySchema.safeParse({
      managerId: searchParams.get('managerId') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }
    const managerIdParam = parsedQuery.data.managerId

    if (managerIdParam && managerIdParam !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { settings, managerScope } = await getSettingsForUser(
      user.id,
      user.role,
      managerIdParam
    )

    return jsonWithPrivateCache({ settings, managerScope })
  } catch (error) {
    logError('GET /api/settings error', error)
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500
    const message = status === 401 ? 'Unauthorized' : 'Internal server error'
    return NextResponse.json({ error: message }, { status })
  }
}
