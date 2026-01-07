import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'

const bulkSchema = z.object({
  action: z.enum(['deactivate']),
  userIds: z.array(z.string().cuid()).min(1),
})

export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const manager = await requireManager()
    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const filteredIds = parsed.data.userIds.filter((id) => id !== manager.id)
    if (filteredIds.length === 0) {
      return NextResponse.json({ error: 'No valid users provided' }, { status: 400 })
    }

    const result = await prisma.user.updateMany({
      where:
        manager.role === 'ADMIN'
          ? {
              id: { in: filteredIds },
              role: 'EMPLOYEE',
            }
          : {
              id: { in: filteredIds },
              managerId: manager.id,
              role: 'EMPLOYEE',
            },
      data: { isActive: false },
    })

    await AuditLogService.log({
      action: AuditAction.USER_UPDATE,
      userId: manager.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      metadata: {
        bulkAction: parsed.data.action,
        userCount: result.count,
        userIds: filteredIds,
      },
    })

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
