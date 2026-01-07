import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { RopSettingsService, type RopSettingsPayload } from '@/lib/services/RopSettingsService'
import { GoalService } from '@/lib/services/GoalService'
import { AuditLogService } from '@/lib/services/AuditLogService'
import { AuditAction } from '@prisma/client'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

const clampPeriodDay = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1
  return Math.min(31, Math.max(1, Math.round(value)))
}

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

const MAX_MONEY = 1_000_000_000

const moneySchema = z.preprocess((value) => safeNumber(value), z.number().min(0).max(MAX_MONEY))
const nullableMoneySchema = z.preprocess((value) => {
  if (value === null) return null
  return safeNumber(value)
}, z.number().min(0).max(MAX_MONEY).nullable())
const percentSchema = z.preprocess((value) => safeNumber(value), z.number().min(0).max(100))
const ratioSchema = z.preprocess((value) => safeNumber(value), z.number().min(0).max(1))
const daysSchema = z.preprocess((value) => safeNumber(value), z.number().int().min(0).max(60))
const minutesSchema = z.preprocess((value) => safeNumber(value), z.number().int().min(1).max(180))
const dropPercentSchema = z.preprocess((value) => safeNumber(value), z.number().int().min(0).max(100))
const activityTargetSchema = z.preprocess(
  (value) => safeNumber(value),
  z.number().int().min(0).max(100)
)
const northStarSchema = z.preprocess((value) => safeNumber(value), z.number().min(0).max(100))
const periodDaySchema = z.preprocess((value) => safeNumber(value), z.number().int().min(1).max(31))

const ropSettingsSchema = z.object({
  departmentGoal: nullableMoneySchema.optional(),
  conversionBenchmarks: z.record(z.string(), percentSchema).optional(),
  alertThresholds: z
    .object({
      warning: ratioSchema.optional(),
      critical: ratioSchema.optional(),
    })
    .optional(),
  alertNoReportDays: daysSchema.optional(),
  alertNoDealsDays: daysSchema.optional(),
  alertConversionDrop: dropPercentSchema.optional(),
  telegramRegistrationTtl: minutesSchema.optional(),
  telegramReportTtl: minutesSchema.optional(),
  activityScoreTarget: activityTargetSchema.optional(),
  northStarTarget: northStarSchema.optional(),
  salesPerDeal: moneySchema.optional(),
  motivationGrades: z
    .array(
      z.object({
        minTurnover: moneySchema,
        maxTurnover: nullableMoneySchema.optional(),
        commissionRate: ratioSchema,
      })
    )
    .optional(),
  periodStartDay: periodDaySchema.optional(),
  managerPlans: z
    .array(
      z.object({
        id: z.string().cuid(),
        monthlyGoal: nullableMoneySchema,
      })
    )
    .optional(),
}).strict()

export async function GET() {
  try {
    const manager = await requireManager()
    const settings = await RopSettingsService.getEffectiveSettings(manager.id)
    const managers = await prisma.user.findMany({
      where: { id: manager.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const managerGoals = await GoalService.getUsersGoals(managers.map((m) => m.id))

    return jsonWithPrivateCache({
      settings,
      managers: managers.map((m) => ({
        ...m,
        monthlyGoal: managerGoals[m.id] ?? 0,
      })),
    })
  } catch (error) {
    logError('GET /api/rop-settings error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const manager = await requireManager()
    const managerExists = await prisma.user.findFirst({
      where: { id: manager.id, isActive: true },
      select: { id: true },
    })
    const targetManagerId = managerExists ? manager.id : null
    const body = await request.json()
    const parsed = ropSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }
    const data = parsed.data

    const payload: RopSettingsPayload = {}

    if (data.departmentGoal !== undefined) payload.departmentGoal = data.departmentGoal

    if (data.conversionBenchmarks && Object.keys(data.conversionBenchmarks).length > 0) {
      payload.conversionBenchmarks = data.conversionBenchmarks
    }

    if (data.alertThresholds && Object.keys(data.alertThresholds).length > 0) {
      payload.alertThresholds = data.alertThresholds
    }

    if (data.alertNoReportDays !== undefined) payload.alertNoReportDays = data.alertNoReportDays
    if (data.alertNoDealsDays !== undefined) payload.alertNoDealsDays = data.alertNoDealsDays
    if (data.alertConversionDrop !== undefined) {
      payload.alertConversionDrop = data.alertConversionDrop
    }
    if (data.telegramRegistrationTtl !== undefined) {
      payload.telegramRegistrationTtl = data.telegramRegistrationTtl
    }
    if (data.telegramReportTtl !== undefined) payload.telegramReportTtl = data.telegramReportTtl

    if (data.activityScoreTarget !== undefined) payload.activityScoreTarget = data.activityScoreTarget

    if (data.northStarTarget !== undefined) payload.northStarTarget = data.northStarTarget

    if (data.salesPerDeal !== undefined) payload.salesPerDeal = data.salesPerDeal

    if (data.motivationGrades && data.motivationGrades.length > 0) {
      payload.motivationGrades = data.motivationGrades.map((grade) => ({
        minTurnover: grade.minTurnover,
        maxTurnover: grade.maxTurnover ?? null,
        commissionRate: grade.commissionRate,
      }))
    }

    if (data.periodStartDay !== undefined) {
      payload.periodStartDay = clampPeriodDay(data.periodStartDay)
    }

    await RopSettingsService.upsertSettings(targetManagerId, payload)

    if (data.managerPlans) {
      const updates = data.managerPlans
        .filter((plan) => plan.id === manager.id)
        .map((plan) => ({
          id: plan.id,
          monthlyGoal: plan.monthlyGoal,
        }))

      await Promise.all(
        updates.map((plan) =>
          GoalService.setUserGoal(plan.id, plan.monthlyGoal ?? null)
        )
      )
    }

    await AuditLogService.log({
      action: AuditAction.SETTINGS_CHANGE,
      userId: manager.id,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      metadata: {
        updatedFields: Object.keys(payload),
        managerPlansUpdated: data.managerPlans?.length ?? 0,
      },
    })

    const settings = await RopSettingsService.getEffectiveSettings(manager.id)
    return NextResponse.json({ settings })
  } catch (error) {
    logError('PUT /api/rop-settings error', error)
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
