import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { getSettingsForUser } from '@/lib/settings/context'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const managerIdParam = searchParams.get('managerId')

    if (managerIdParam && user.role !== 'MANAGER' && managerIdParam !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { settings, managerScope } = await getSettingsForUser(
      user.id,
      user.role,
      managerIdParam
    )

    return NextResponse.json({ settings, managerScope })
  } catch (error) {
    console.error('GET /api/settings error', error)
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500
    const message = status === 401 ? 'Unauthorized' : 'Internal server error'
    return NextResponse.json({ error: message }, { status })
  }
}
