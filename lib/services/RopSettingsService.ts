import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { CONVERSION_BENCHMARKS } from '@/lib/config/conversionBenchmarks'
import { KPI_BENCHMARKS, PLAN_HEURISTICS } from '@/lib/config/metrics'
import { MOTIVATION_GRADE_PRESETS, type MotivationGradeConfig } from '@/lib/config/motivationGrades'
import {
  parseConversionBenchmarks,
  parseAlertThresholds,
  parseMotivationGrades,
} from '@/lib/schemas/ropSettings'
import { toDecimal, toNumber } from '@/lib/utils/decimal'

export type ConversionBenchmarkConfig = typeof CONVERSION_BENCHMARKS

export interface AlertThresholdConfig {
  warning: number
  critical: number
}

export interface EffectiveRopSettings {
  departmentGoal: number | null
  conversionBenchmarks: ConversionBenchmarkConfig
  alertThresholds: AlertThresholdConfig
  alertNoReportDays: number
  alertNoDealsDays: number
  alertConversionDrop: number
  telegramRegistrationTtl: number
  telegramReportTtl: number
  activityScoreTarget: number
  northStarTarget: number
  salesPerDeal: number
  motivationGrades: MotivationGradeConfig[]
  periodStartDay: number
}

export interface RopSettingsPayload {
  departmentGoal?: number | null
  conversionBenchmarks?: Partial<ConversionBenchmarkConfig>
  alertThresholds?: Partial<AlertThresholdConfig>
  alertNoReportDays?: number
  alertNoDealsDays?: number
  alertConversionDrop?: number
  telegramRegistrationTtl?: number
  telegramReportTtl?: number
  activityScoreTarget?: number
  northStarTarget?: number
  salesPerDeal?: number
  motivationGrades?: MotivationGradeConfig[]
  periodStartDay?: number
}

const DEFAULT_ALERT_THRESHOLDS: AlertThresholdConfig = {
  warning: 0.9,
  critical: 0.7,
}

const DEFAULT_ALERT_RULES = {
  noReportDays: 2,
  noDealsDays: 5,
  conversionDrop: 20,
}

const DEFAULT_TELEGRAM_TTL = {
  registration: 15,
  report: 30,
}

export class RopSettingsService {
  static async getEffectiveSettings(managerId?: string | null): Promise<EffectiveRopSettings> {
    const [managerScoped, globalSettings] = await Promise.all([
      managerId
        ? prisma.ropSettings.findFirst({
            where: { managerId },
          })
        : Promise.resolve(null),
      prisma.ropSettings.findFirst({
        where: { managerId: null },
      }),
    ])

    const settings = managerScoped ?? globalSettings

    // Используем safe parse с валидацией через Zod схемы
    const parsedBenchmarks = parseConversionBenchmarks(settings?.conversionBenchmarks)
    const conversionBenchmarks: ConversionBenchmarkConfig = {
      ...CONVERSION_BENCHMARKS,
      ...(parsedBenchmarks ?? {}),
    }

    const parsedThresholds = parseAlertThresholds(settings?.alertThresholds)
    const alertThresholds: AlertThresholdConfig = {
      ...DEFAULT_ALERT_THRESHOLDS,
      ...(parsedThresholds ?? {}),
    }

    // Safe parse для motivationGrades (поддержка legacy формата { grades: [...] })
    const parsedGrades = parseMotivationGrades(settings?.motivationGrades)
    const motivationGrades: MotivationGradeConfig[] = parsedGrades ?? MOTIVATION_GRADE_PRESETS

    return {
      departmentGoal: settings?.departmentGoal ? toNumber(toDecimal(settings.departmentGoal)) : null,
      conversionBenchmarks,
      alertThresholds,
      alertNoReportDays: settings?.alertNoReportDays ?? DEFAULT_ALERT_RULES.noReportDays,
      alertNoDealsDays: settings?.alertNoDealsDays ?? DEFAULT_ALERT_RULES.noDealsDays,
      alertConversionDrop: settings?.alertConversionDrop ?? DEFAULT_ALERT_RULES.conversionDrop,
      telegramRegistrationTtl: settings?.telegramRegistrationTtl ?? DEFAULT_TELEGRAM_TTL.registration,
      telegramReportTtl: settings?.telegramReportTtl ?? DEFAULT_TELEGRAM_TTL.report,
      activityScoreTarget: settings?.activityScoreTarget ?? KPI_BENCHMARKS.ACTIVITY_SCORE,
      northStarTarget: settings?.northStarTarget ?? KPI_BENCHMARKS.NORTH_STAR,
      salesPerDeal: settings?.salesPerDeal
        ? toNumber(toDecimal(settings.salesPerDeal))
        : PLAN_HEURISTICS.SALES_PER_DEAL,
      motivationGrades,
      periodStartDay: settings?.periodStartDay ?? 1,
    }
  }

  static async upsertSettings(managerId: string | null, payload: RopSettingsPayload) {
    const existing = await prisma.ropSettings.findFirst({
      where: { managerId: managerId ?? null },
    })

    const updateData: Prisma.RopSettingsUncheckedUpdateInput = {}
    const toJsonValue = (value: unknown) => value as Prisma.InputJsonValue

    if (payload.departmentGoal !== undefined) updateData.departmentGoal = payload.departmentGoal
    if (payload.conversionBenchmarks) {
      updateData.conversionBenchmarks = toJsonValue(payload.conversionBenchmarks)
    }
    if (payload.alertThresholds) {
      updateData.alertThresholds = toJsonValue(payload.alertThresholds)
    }
    if (payload.alertNoReportDays !== undefined) updateData.alertNoReportDays = payload.alertNoReportDays
    if (payload.alertNoDealsDays !== undefined) updateData.alertNoDealsDays = payload.alertNoDealsDays
    if (payload.alertConversionDrop !== undefined) {
      updateData.alertConversionDrop = payload.alertConversionDrop
    }
    if (payload.telegramRegistrationTtl !== undefined) {
      updateData.telegramRegistrationTtl = payload.telegramRegistrationTtl
    }
    if (payload.telegramReportTtl !== undefined) updateData.telegramReportTtl = payload.telegramReportTtl
    if (payload.activityScoreTarget !== undefined) {
      updateData.activityScoreTarget = payload.activityScoreTarget
    }
    if (payload.northStarTarget !== undefined) updateData.northStarTarget = payload.northStarTarget
    if (payload.salesPerDeal !== undefined) updateData.salesPerDeal = payload.salesPerDeal
    if (payload.motivationGrades) {
      updateData.motivationGrades = toJsonValue(payload.motivationGrades)
    }
    if (payload.periodStartDay !== undefined) updateData.periodStartDay = payload.periodStartDay

    if (existing) {
      return prisma.ropSettings.update({
        where: { id: existing.id },
        data: updateData,
      })
    }

    const createData: Prisma.RopSettingsUncheckedCreateInput = {
      managerId: managerId ?? null,
    }

    if (payload.departmentGoal !== undefined) createData.departmentGoal = payload.departmentGoal
    if (payload.conversionBenchmarks) {
      createData.conversionBenchmarks = toJsonValue(payload.conversionBenchmarks)
    }
    if (payload.alertThresholds) {
      createData.alertThresholds = toJsonValue(payload.alertThresholds)
    }
    if (payload.alertNoReportDays !== undefined) createData.alertNoReportDays = payload.alertNoReportDays
    if (payload.alertNoDealsDays !== undefined) createData.alertNoDealsDays = payload.alertNoDealsDays
    if (payload.alertConversionDrop !== undefined) {
      createData.alertConversionDrop = payload.alertConversionDrop
    }
    if (payload.telegramRegistrationTtl !== undefined) {
      createData.telegramRegistrationTtl = payload.telegramRegistrationTtl
    }
    if (payload.telegramReportTtl !== undefined) createData.telegramReportTtl = payload.telegramReportTtl
    if (payload.activityScoreTarget !== undefined) {
      createData.activityScoreTarget = payload.activityScoreTarget
    }
    if (payload.northStarTarget !== undefined) createData.northStarTarget = payload.northStarTarget
    if (payload.salesPerDeal !== undefined) createData.salesPerDeal = payload.salesPerDeal
    if (payload.motivationGrades) {
      createData.motivationGrades = toJsonValue(payload.motivationGrades)
    }
    if (payload.periodStartDay !== undefined) createData.periodStartDay = payload.periodStartDay

    return prisma.ropSettings.create({
      data: createData,
    })
  }
}
