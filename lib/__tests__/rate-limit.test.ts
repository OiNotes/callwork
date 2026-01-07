import { describe, it, expect, vi, beforeEach } from 'vitest'

const limitMock = vi.fn()

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return 'window'
    }
    limit = limitMock
    constructor() {}
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {}
  },
}))

const loadModule = async () => {
  vi.resetModules()
  return import('@/lib/rate-limit')
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    limitMock.mockReset()
  })

  it('allows within limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    limitMock.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 })

    const { checkRateLimit } = await loadModule()
    const result = await checkRateLimit('user-1', 'api')

    expect(result.success).toBe(true)
    expect(limitMock).toHaveBeenCalled()
  })

  it('blocks when exceeded', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    limitMock.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

    const { checkRateLimit } = await loadModule()
    const result = await checkRateLimit('user-2', 'api')

    expect(result.success).toBe(false)
  })

  it('gracefully allows when Redis not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { checkRateLimit } = await loadModule()
    const result = await checkRateLimit('user-3', 'api')

    expect(result).toEqual({ success: true, limit: 0, remaining: 0, reset: 0 })
  })
})
