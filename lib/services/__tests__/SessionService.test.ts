import { describe, it, expect, vi } from 'vitest'
import { SessionService } from '@/lib/services/SessionService'
import { prismaMock } from '@/tests/mocks/prisma'

describe('SessionService', () => {
  it('creates a session', async () => {
    prismaMock.userSession.create.mockResolvedValue({ id: 'session-1' } as never)

    await SessionService.createSession({
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'UA',
      expiresAt: new Date(),
    })

    expect(prismaMock.userSession.create).toHaveBeenCalled()
  })

  it('revokes a session', async () => {
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 1 } as never)

    await SessionService.revokeSession('session-1', 'user-1')

    expect(prismaMock.userSession.updateMany).toHaveBeenCalled()
  })

  it('throws when revoke fails', async () => {
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 0 } as never)

    await expect(SessionService.revokeSession('session-1')).rejects.toThrow('Session not found')
  })

  it('skips touch update when throttled', async () => {
    vi.useFakeTimers()
    const now = new Date()
    vi.setSystemTime(now)

    await SessionService.touchSession('session-1', new Date(now.getTime() - 60 * 1000))

    expect(prismaMock.userSession.update).not.toHaveBeenCalled()
  })
})
