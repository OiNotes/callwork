import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { RopSettingsService, type RopSettingsPayload } from '@/lib/services/RopSettingsService'
import { MOTIVATION_GRADE_PRESETS } from '@/lib/config/motivationGrades'

const clampPeriodDay = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1
  return Math.min(31, Math.max(1, Math.round(value)))
}

const safeNumber = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  const num = typeof value === 'string' ? Number(value) : (value as number)
  if (!Number.isFinite(num)) return undefined
  return num
}

export async function GET() {
  try {
    const manager = await requireManager()
    const settings = await RopSettingsService.getEffectiveSettings(manager.id)
    const managers = await prisma.user.findMany({
      where: { role: 'MANAGER', isActive: true },
      select: { id: true, name: true, monthlyGoal: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ settings, managers })
  } catch (error) {
    console.error('GET /api/rop-settings error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const manager = await requireManager()
    const managerExists = await prisma.user.findUnique({ where: { id: manager.id } })
    const targetManagerId = managerExists ? manager.id : null
    const body = await request.json()

    const payload: RopSettingsPayload = {}

    const departmentGoal = safeNumber(body.departmentGoal)
    if (departmentGoal !== undefined) payload.departmentGoal = departmentGoal

    if (body.conversionBenchmarks) {
      const entries = Object.entries(body.conversionBenchmarks as Record<string, unknown>).reduce(
        (acc: Record<string, number>, [key, value]) => {
          const parsed = safeNumber(value)
          if (parsed !== undefined) acc[key] = parsed
          return acc
        },
        {}
      )
      if (Object.keys(entries).length > 0) {
        payload.conversionBenchmarks = entries as any
      }
    }

    if (body.alertThresholds) {
      const warning = safeNumber(body.alertThresholds.warning)
      const critical = safeNumber(body.alertThresholds.critical)
      const alertPayload: Record<string, number> = {}
      if (warning !== undefined) alertPayload.warning = warning
      if (critical !== undefined) alertPayload.critical = critical
      if (Object.keys(alertPayload).length > 0) {
        payload.alertThresholds = alertPayload as any
      }
    }

    const activityTarget = safeNumber(body.activityScoreTarget)
    if (activityTarget !== undefined) payload.activityScoreTarget = activityTarget

    const northStarTarget = safeNumber(body.northStarTarget)
    if (northStarTarget !== undefined) payload.northStarTarget = northStarTarget

    const salesPerDeal = safeNumber(body.salesPerDeal)
    if (salesPerDeal !== undefined) payload.salesPerDeal = salesPerDeal

    if (Array.isArray(body.motivationGrades)) {
      const grades = (body.motivationGrades as any[])
        .map((grade) => {
          const cleaned: Record<string, number | null> = {}
          const min = safeNumber(grade.minTurnover)
          const max = grade.maxTurnover === null ? null : safeNumber(grade.maxTurnover)
          const commission = safeNumber(grade.commissionRate)
          if (min !== undefined) cleaned.minTurnover = min
          if (max !== undefined) cleaned.maxTurnover = max
          if (max === null) cleaned.maxTurnover = null
          if (commission !== undefined) cleaned.commissionRate = commission
          return cleaned
        })
        .filter((g) => Object.keys(g).length > 0)
      if (grades.length > 0) {
        payload.motivationGrades = grades as any
      }
    }

    const periodStartDay = safeNumber(body.periodStartDay)
    if (periodStartDay !== undefined) payload.periodStartDay = clampPeriodDay(periodStartDay)

    await RopSettingsService.upsertSettings(targetManagerId, payload)

    if (Array.isArray(body.managerPlans)) {
      const updates = (body.managerPlans as any[])
        .map((plan) => ({
          id: plan.id as string,
          monthlyGoal:
            plan.monthlyGoal === null ? null : safeNumber(plan.monthlyGoal),
        }))
        .filter((p) => p.id && (p.monthlyGoal === null || typeof p.monthlyGoal === 'number'))

      await Promise.all(
        updates.map((plan) =>
          prisma.user.update({
            where: { id: plan.id },
            data: { monthlyGoal: plan.monthlyGoal },
          })
        )
      )
    }

    const settings = await RopSettingsService.getEffectiveSettings(manager.id)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('PUT /api/rop-settings error', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message.includes('Forbidden')
        ? 403
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
