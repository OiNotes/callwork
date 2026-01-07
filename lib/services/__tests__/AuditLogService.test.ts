import { describe, it, expect } from 'vitest'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { prismaMock } from '@/tests/mocks/prisma'
import { AuditAction } from '@prisma/client'

describe('AuditLogService', () => {
  it('logs LOGIN with metadata', async () => {
    prismaMock.auditLog.create.mockResolvedValue({} as never)

    await AuditLogService.log({
      action: AuditAction.LOGIN,
      userId: 'user-1',
      metadata: { sessionId: 'session-1' },
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: AuditAction.LOGIN,
        userId: 'user-1',
        targetUserId: null,
        ipAddress: null,
        userAgent: null,
        metadata: { sessionId: 'session-1' },
      },
    })
  })
})
