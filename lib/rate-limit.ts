/**
 * In-memory Rate Limiter для защиты от brute-force атак
 *
 * Используется для:
 * - /api/auth/register - защита от спама регистраций
 * - /api/telegram/generate-code - защита от спама генерации кодов
 *
 * Особенности:
 * - In-memory хранилище (без Redis)
 * - Автоматическая очистка истёкших записей
 * - Потокобезопасный для single-instance Node.js
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitConfig {
  /** Окно времени в миллисекундах */
  windowMs: number
  /** Максимальное количество запросов за окно */
  maxRequests: number
}

interface RateLimitResult {
  /** true если лимит превышен */
  limited: boolean
  /** Оставшееся количество запросов */
  remaining: number
  /** Timestamp когда лимит сбросится */
  resetAt: number
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Очистка истёкших записей каждую минуту
    // Проверяем что setInterval доступен (может не быть в edge runtime)
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
      // Не блокируем процесс при завершении
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  /**
   * Удаление истёкших записей для предотвращения memory leak
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (entry.resetAt <= now) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Проверка и учёт запроса по ключу
   *
   * @param key Уникальный ключ (например, IP или userId)
   * @param config Конфигурация лимита
   * @returns Результат проверки лимита
   */
  isRateLimited(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const entry = this.store.get(key)

    // Нет записи или истекла - создаём новую
    if (!entry || entry.resetAt <= now) {
      const resetAt = now + config.windowMs
      this.store.set(key, { count: 1, resetAt })
      return {
        limited: false,
        remaining: config.maxRequests - 1,
        resetAt,
      }
    }

    // Увеличиваем счётчик
    entry.count++
    this.store.set(key, entry)

    const limited = entry.count > config.maxRequests
    const remaining = Math.max(0, config.maxRequests - entry.count)

    return { limited, remaining, resetAt: entry.resetAt }
  }

  /**
   * Сброс лимита для ключа (для тестов)
   */
  reset(key?: string): void {
    if (key) {
      this.store.delete(key)
    } else {
      this.store.clear()
    }
  }

  /**
   * Получение текущего состояния (для отладки)
   */
  getStats(): { totalKeys: number; keys: string[] } {
    return {
      totalKeys: this.store.size,
      keys: Array.from(this.store.keys()),
    }
  }
}

// Singleton instance
export const rateLimiter = new InMemoryRateLimiter()

/**
 * Предустановленные конфигурации лимитов
 */
export const RATE_LIMITS = {
  /** Регистрация: 5 попыток в минуту по IP */
  register: { windowMs: 60_000, maxRequests: 5 },

  /** Генерация Telegram кода: 3 попытки за 5 минут по userId */
  telegramCode: { windowMs: 300_000, maxRequests: 3 },

  /** Логин: 10 попыток в минуту по IP */
  login: { windowMs: 60_000, maxRequests: 10 },

  /** Общий API лимит: 100 запросов в минуту */
  api: { windowMs: 60_000, maxRequests: 100 },
} as const

/**
 * Извлечение IP адреса клиента из заголовков запроса
 *
 * Поддерживает:
 * - x-forwarded-for (прокси, load balancer)
 * - x-real-ip (nginx)
 * - Fallback на 'unknown'
 */
export function getClientIP(request: Request): string {
  const headers = request.headers

  // x-forwarded-for может содержать несколько IP через запятую
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * Создание HTTP ответа 429 Too Many Requests
 *
 * @param resetAt Timestamp когда лимит сбросится
 * @returns Response с правильными заголовками
 */
export function rateLimitResponse(resetAt: number): Response {
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

/**
 * Middleware helper для применения rate limit
 *
 * @example
 * const result = checkRateLimit(request, 'register')
 * if (result) return result // Rate limited
 * // ... continue with request
 */
export function checkRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  customKey?: string
): Response | null {
  const key = customKey || `${limitType}:${getClientIP(request)}`
  const config = RATE_LIMITS[limitType]
  const result = rateLimiter.isRateLimited(key, config)

  if (result.limited) {
    return rateLimitResponse(result.resetAt)
  }

  return null
}
