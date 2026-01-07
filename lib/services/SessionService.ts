import { prisma } from '@/lib/prisma'

const SESSION_TOUCH_THROTTLE_MS = 5 * 60 * 1000

export interface CreateSessionInput {
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
  expiresAt?: Date | null
}

export class SessionService {
  static async createSession(input: CreateSessionInput) {
    const { userId, ipAddress, userAgent, expiresAt } = input
    return prisma.userSession.create({
      data: {
        userId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt: expiresAt ?? null,
      },
    })
  }

  static async getSession(sessionId: string) {
    return prisma.userSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
        ipAddress: true,
        userAgent: true,
      },
    })
  }

  static async listActiveSessions(userId: string) {
    const now = new Date()
    return prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    })
  }

  static async revokeSession(sessionId: string, userId?: string) {
    const where = userId ? { id: sessionId, userId } : { id: sessionId }
    const result = await prisma.userSession.updateMany({
      where,
      data: { revokedAt: new Date() },
    })
    if (result.count === 0) {
      throw new Error('Session not found')
    }
    return result
  }

  static async touchSession(sessionId: string, lastSeenAt: Date) {
    const now = new Date()
    if (now.getTime() - lastSeenAt.getTime() < SESSION_TOUCH_THROTTLE_MS) {
      return
    }
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: now },
    })
  }
}
