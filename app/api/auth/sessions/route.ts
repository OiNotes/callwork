import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAuth } from '@/lib/auth/get-session'
import { SessionService } from '@/lib/services/SessionService'
import { z } from 'zod'
import { csrfError, validateOrigin } from '@/lib/csrf'

const revokeSchema = z.object({
  sessionId: z.string().cuid(),
})

export async function GET() {
  try {
    const user = await requireAuth()
    const session = await getServerSession(authOptions)
    const sessions = await SessionService.listActiveSessions(user.id)

    return NextResponse.json({
      sessions,
      currentSessionId: session?.user?.sessionId ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = revokeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    try {
      await SessionService.revokeSession(parsed.data.sessionId, user.id)
      return NextResponse.json({ success: true })
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
