import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function verifyBearerToken(authHeader: string | null, secret: string | undefined): boolean {
  if (!authHeader || !secret) return false

  const prefix = 'Bearer '
  if (!authHeader.startsWith(prefix)) return false

  const providedToken = authHeader.slice(prefix.length)
  const providedBuffer = Buffer.from(providedToken.padEnd(64, '\0'))
  const expectedBuffer = Buffer.from(secret.padEnd(64, '\0'))

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

export async function GET(request: Request) {
  const secret = process.env.HEALTH_SECRET
  const hasAccess = !secret || verifyBearerToken(request.headers.get('authorization'), secret)

  if (!hasAccess) {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
      },
      { status: 503 }
    )
  }
}
