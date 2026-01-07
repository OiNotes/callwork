import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { logError, logWarning } from '@/lib/logger'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

/**
 * Next.js Middleware для защиты маршрутов и добавления security headers
 *
 * Защищает:
 * - /dashboard/* - требует авторизации
 * - /api/* - требует авторизации (кроме исключений)
 *
 * CVE-2025-29927 Protection:
 * - Блокируем x-middleware-subrequest header от клиентов
 */

// Публичные API endpoints (не требуют авторизации)
const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/cron',
]

const RATE_LIMIT_EXEMPT_PATHS = [
  '/api/health',
  '/api/cron',
]

// Публичные страницы
const PUBLIC_PAGES = [
  '/login',
  '/register',
  '/',
]

const generateNonce = () => {
  const uuid = crypto.randomUUID()
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uuid).toString('base64')
  }
  return btoa(uuid)
}

const nextWithNonce = (request: NextRequest, nonce: string) => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

function addSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self' https://api.telegram.org;
    frame-ancestors 'none';
  `
  response.headers.set('Content-Security-Policy', csp.replace(/\s+/g, ' ').trim())
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('X-Nonce', nonce)

  // HSTS only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = generateNonce()

  // CVE-2025-29927: Block x-middleware-subrequest header from external requests
  // This header should only be set by Next.js internally
  if (request.headers.get('x-middleware-subrequest')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Публичные страницы - пропускаем проверку auth
  if (PUBLIC_PAGES.some(path => pathname === path)) {
    const response = nextWithNonce(request, nonce)
    return addSecurityHeaders(response, nonce)
  }

  // Static assets and Next.js internals - skip
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // Static files with extensions
  ) {
    return NextResponse.next()
  }

  const isApiRoute = pathname.startsWith('/api/')
  const rateLimitEnabled = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  )

  if (isApiRoute && rateLimitEnabled && !RATE_LIMIT_EXEMPT_PATHS.some(path => pathname.startsWith(path))) {
    const identifier = `${getClientIP(request)}:${pathname}:${request.method}`
    try {
      const rateLimit = await checkRateLimit(identifier, 'api')
      if (!rateLimit.success) {
        const resetAt = typeof rateLimit.reset === 'number'
          ? rateLimit.reset
          : rateLimit.reset.getTime()
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
        const response = NextResponse.json(
          {
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter,
          },
          { status: 429 }
        )
        response.headers.set('Retry-After', String(Math.max(1, retryAfter)))
        response.headers.set('X-RateLimit-Limit', String(rateLimit.limit))
        response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining))
        response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
        return addSecurityHeaders(response, nonce)
      }
    } catch (error) {
      logWarning('Rate limiting skipped due to error', {
        error: error instanceof Error ? error.message : 'unknown error'
      })
    }
  }

  // Публичные API endpoints
  if (PUBLIC_API_PATHS.some(path => pathname.startsWith(path))) {
    const response = nextWithNonce(request, nonce)
    return addSecurityHeaders(response, nonce)
  }

  // Все остальные /api/* и /dashboard/* требуют авторизации
  if (pathname.startsWith('/api/') || pathname.startsWith('/dashboard')) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      })

      if (!token) {
        // API endpoints возвращают 401
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized' }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(addSecurityHeaders(NextResponse.next(), nonce).headers),
              },
            }
          )
        }

        // Dashboard редиректит на login
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Авторизован - добавляем security headers и пропускаем
      const response = nextWithNonce(request, nonce)
      return addSecurityHeaders(response, nonce)
    } catch (error) {
      logError('Middleware auth error', error)

      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Fallback - redirect to login
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Все остальные запросы - добавляем security headers
  const response = nextWithNonce(request, nonce)
  return addSecurityHeaders(response, nonce)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
