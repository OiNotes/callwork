import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = new Map<string, number>()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async incr(key: string) {
      const next = (store.get(key) ?? 0) + 1
      store.set(key, next)
      return next
    }
    async expire() {
      return 1
    }
    async get(key: string) {
      return store.get(key) ?? null
    }
    async del(key: string) {
      store.delete(key)
      return 1
    }
  },
}))

describe('LoginLockout', () => {
  beforeEach(() => {
    store.clear()
  })

  it('locks after 5 attempts', async () => {
    const { buildLockoutKey, recordFailedAttempt, isLocked } = await import('@/lib/auth/login-lockout')
    const key = buildLockoutKey('user@example.com', '127.0.0.1')

    let last = { locked: false, attemptsLeft: 5 }
    for (let i = 0; i < 5; i += 1) {
      last = await recordFailedAttempt(key)
    }

    expect(last.locked).toBe(true)
    expect(last.attemptsLeft).toBe(0)
    expect(await isLocked(key)).toBe(true)
  })

  it('clears lockout', async () => {
    const { buildLockoutKey, recordFailedAttempt, isLocked, clearLockout } = await import('@/lib/auth/login-lockout')
    const key = buildLockoutKey('user@example.com', '127.0.0.1')
    await recordFailedAttempt(key)
    await clearLockout(key)
    expect(await isLocked(key)).toBe(false)
  })
})
