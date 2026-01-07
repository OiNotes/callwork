import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logWarning } from '@/lib/logger'

const RATE_LIMITS = {
  register: { window: '60 s', max: 5 },
  telegramCode: { window: '300 s', max: 3 },
  login: { window: '60 s', max: 10 },
  api: { window: '60 s', max: 100 },
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number | Date
}

let redis: Redis | null = null
let rateLimitEnabled = false
let warnedMissingConfig = false
const rateLimiters: Partial<Record<RateLimitType, Ratelimit>> = {}

const initRedis = () => {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (!warnedMissingConfig) {
      logWarning('Upstash Redis not configured, rate limiting disabled')
      warnedMissingConfig = true
    }
    rateLimitEnabled = false
    return null
  }
  redis = new Redis({ url, token })
  rateLimitEnabled = true
  return redis
}

const getLimiter = (limitType: RateLimitType): Ratelimit | null => {
  const client = initRedis()
  if (!client) return null
  const existing = rateLimiters[limitType]
  if (existing) return existing
  const config = RATE_LIMITS[limitType]
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(config.max, config.window),
    analytics: true,
  })
  rateLimiters[limitType] = limiter
  return limiter
}

export async function checkRateLimit(
  identifier: string,
  limitType: RateLimitType = 'api'
): Promise<RateLimitResult> {
  const limiter = getLimiter(limitType)
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
  return limiter.limit(`${limitType}:${identifier}`) as Promise<RateLimitResult>
}

export { rateLimitEnabled }

export function rateLimitResponse(result: {
  reset: number | Date
  limit: number
  remaining: number
}) {
  const resetAt = typeof result.reset === 'number' ? result.reset : result.reset.getTime()
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter)),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    }
  )
}

export function getClientIP(request: Request): string {
  const headers = request.headers
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return 'unknown'
}
