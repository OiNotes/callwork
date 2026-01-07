import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { AuditAction, Role } from '@prisma/client'
import { SessionService } from '@/lib/services/SessionService'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { headers } from 'next/headers'
import { buildLockoutKey, clearLockout, isLocked, recordFailedAttempt } from '@/lib/auth/login-lockout'
import { logWarning } from '@/lib/logger'

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

type HeadersLike = Headers | Record<string, string | string[] | undefined>

const getHeader = (headers: HeadersLike | undefined, name: string): string | null => {
  if (!headers) return null
  if (headers instanceof Headers) return headers.get(name)
  const key = name.toLowerCase()
  const value = headers[key] ?? headers[name]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const resolveClientIp = (req?: Request | { headers?: HeadersLike }) => {
  const headers = req?.headers
  const realIp = getHeader(headers, 'x-real-ip')
  if (realIp) return realIp
  const cfIp = getHeader(headers, 'cf-connecting-ip')
  if (cfIp) return cfIp
  const forwarded = getHeader(headers, 'x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return 'unknown'
}

const resolveUserAgent = (req?: Request | { headers?: HeadersLike }) => {
  const headers = req?.headers
  return getHeader(headers, 'user-agent')
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const ipAddress = resolveClientIp(req)
        const userAgent = resolveUserAgent(req)
        const lockoutKey = buildLockoutKey(credentials.email, ipAddress)
        const locked = await isLocked(lockoutKey)
        if (locked) {
          throw new Error('Too many failed attempts. Try again later.')
        }

        const user = await prisma.user.findFirst({
          where: { email: credentials.email, isActive: true },
        })

        if (!user || !user.password) {
          await recordFailedAttempt(lockoutKey)
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          await recordFailedAttempt(lockoutKey)
          throw new Error('Invalid credentials')
        }

        await clearLockout(lockoutKey)
        const now = new Date()
        const session = await SessionService.createSession({
          userId: user.id,
          ipAddress,
          userAgent,
          expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
        })
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: now },
        })
        await AuditLogService.log({
          action: AuditAction.LOGIN,
          userId: user.id,
          ipAddress,
          userAgent,
          metadata: { sessionId: session.id },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionId: session.id,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.sessionId = user.sessionId
      }
      if (trigger === 'update' && session) {
        const updatedName = (session as { name?: string }).name
        const updatedEmail = (session as { email?: string }).email
        if (updatedName) token.name = updatedName
        if (updatedEmail) token.email = updatedEmail
      }
      if (token.sessionId) {
        const session = await SessionService.getSession(token.sessionId)
        if (
          !session ||
          session.userId !== token.id ||
          session.revokedAt ||
          (session.expiresAt && session.expiresAt <= new Date())
        ) {
          throw new Error('Session revoked')
        }
        try {
          const requestHeaders = await headers()
          const currentIp =
            requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            requestHeaders.get('x-real-ip') ||
            'unknown'
          const currentUa = requestHeaders.get('user-agent') || 'unknown'

          const ipMismatch = session.ipAddress && session.ipAddress !== currentIp
          const uaMismatch = session.userAgent && session.userAgent !== currentUa

          if (ipMismatch || uaMismatch) {
            logWarning('Session fingerprint mismatch', {
              userId: token.id,
              sessionId: token.sessionId,
              originalIp: session.ipAddress,
              currentIp,
              originalUa: session.userAgent,
              currentUa,
            })
            await prisma.userSession.update({
              where: { id: token.sessionId as string },
              data: { revokedAt: new Date() },
            })
            throw new Error('Session revoked')
          }
        } catch {
          // Ignore header access errors outside request context
        }
        await SessionService.touchSession(session.id, session.lastSeenAt)
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        if (token.sessionId) {
          session.user.sessionId = token.sessionId as string
        }
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
      }
      return session
    },
  },
  events: {
    async signOut({ token, session }) {
      const sessionId = token?.sessionId as string | undefined
      const userId = (token?.id as string | undefined) ?? session?.user?.id
      if (sessionId) {
        await SessionService.revokeSession(sessionId).catch(() => undefined)
      }
      await AuditLogService.log({
        action: AuditAction.LOGOUT,
        userId: userId ?? null,
        metadata: sessionId ? { sessionId } : undefined,
      })
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  secret: process.env.NEXTAUTH_SECRET,
}
