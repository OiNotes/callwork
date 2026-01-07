import { NextResponse } from 'next/server'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { requireManager } from '@/lib/auth/get-session'
import { GoalAdminService } from '@/lib/services/GoalAdminService'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'

const MAX_MONEY = 1_000_000_000

const safeNumber = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  try {
    const decimal = new Decimal(value)
    if (!decimal.isFinite()) return undefined
    return decimal.toNumber()
  } catch {
    return undefined
  }
}

const moneySchema = z.preprocess((value) => safeNumber(value), z.number().min(0).max(MAX_MONEY))
const nullableMoneySchema = z.preprocess((value) => {
  if (value === null) return null
  return safeNumber(value)
}, z.number().min(0).max(MAX_MONEY).nullable())

const updateSchema = z.object({
  updates: z
    .array(
      z.object({
        userId: z.string().cuid(),
        monthlyGoal: nullableMoneySchema,
      })
    )
    .min(1)
    .max(200),
  source: z.enum(['manual', 'import']).optional(),
})

export async function GET() {
  try {
    const manager = await requireManager()
    const goals = await GoalAdminService.getTeamGoals(manager.id)
    return NextResponse.json({ goals })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const manager = await requireManager()
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const { updates, source } = parsed.data
    const result = await GoalAdminService.applyGoalUpdates(manager.id, updates, {
      source: source ?? 'manual',
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
