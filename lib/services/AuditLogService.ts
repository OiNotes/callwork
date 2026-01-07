import { prisma } from '@/lib/prisma'
import { AuditAction, Prisma } from '@prisma/client'

export interface AuditLogParams {
  action: AuditAction
  userId?: string | null
  targetUserId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}

export class AuditLogService {
  static async log(params: AuditLogParams) {
    const { action, userId, targetUserId, ipAddress, userAgent, metadata } = params
    await prisma.auditLog.create({
      data: {
        action,
        userId: userId ?? null,
        targetUserId: targetUserId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: metadata ?? undefined,
      },
    })
  }
}
