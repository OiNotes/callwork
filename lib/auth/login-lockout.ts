import { Redis } from '@upstash/redis'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

export function buildLockoutKey(email: string, ipAddress: string) {
  return `lockout:${email.toLowerCase()}:${ipAddress}`
}

export async function recordFailedAttempt(key: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const client = getRedis()
  if (!client) {
    return { locked: false, attemptsLeft: MAX_ATTEMPTS }
  }

  try {
    const attempts = await client.incr(key)
    if (attempts === 1) {
      await client.expire(key, LOCKOUT_DURATION)
    }

    return {
      locked: attempts >= MAX_ATTEMPTS,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
    }
  } catch {
    return { locked: false, attemptsLeft: MAX_ATTEMPTS }
  }
}

export async function isLocked(key: string): Promise<boolean> {
  const client = getRedis()
  if (!client) return false

  try {
    const attempts = await client.get<number>(key)
    return (attempts ?? 0) >= MAX_ATTEMPTS
  } catch {
    return false
  }
}

export async function clearLockout(key: string): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    await client.del(key)
  } catch {
    // ignore
  }
}
