import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'

export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const user = await requireAuth()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: null,
        telegramCode: null,
        codeExpiresAt: null,
      },
    })

    await AuditLogService.log({
      action: AuditAction.USER_UPDATE,
      userId: user.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      metadata: { telegramUnlinked: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
