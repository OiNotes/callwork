import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { csrfError, validateOrigin } from '@/lib/csrf'

export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const user = await requireAuth()

    // Rate limiting: 3 попытки за 5 минут по userId
    const rateLimitResult = await checkRateLimit(`telegramCode:${user.id}`, 'telegramCode')
    if (!rateLimitResult.success) return rateLimitResponse(rateLimitResult)

    // Генерация 6-значного кода
    const code = crypto.randomInt(100000, 999999).toString()
    
    const settings = await RopSettingsService.getEffectiveSettings(null)
    const expiresAt = new Date(Date.now() + settings.telegramRegistrationTtl * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramCode: code,
        codeExpiresAt: expiresAt,
      },
    })

    return NextResponse.json({
      code,
      message: 'Код сгенерирован. Используйте команду /register в Telegram боте.',
      expiresAt,
    })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
