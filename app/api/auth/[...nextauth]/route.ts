import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'

const handler = NextAuth(authOptions)

export { handler as GET }

export async function POST(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  if (!validateOrigin(req)) {
    return csrfError()
  }

  const rateLimitResult = await checkRateLimit(`login:${getClientIP(req)}`, 'login')
  if (!rateLimitResult.success) return rateLimitResponse(rateLimitResult)
  return handler(req, context)
}
