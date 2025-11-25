import { prisma } from '@/lib/prisma'
import { CONVERSION_BENCHMARKS } from '@/lib/config/conversionBenchmarks'
import { KPI_BENCHMARKS, PLAN_HEURISTICS } from '@/lib/config/metrics'
import { MOTIVATION_GRADE_PRESETS, type MotivationGradeConfig } from '@/lib/config/motivationGrades'
import {
  parseConversionBenchmarks,
  parseAlertThresholds,
  parseMotivationGrades,
} from '@/lib/schemas/ropSettings'

export type ConversionBenchmarkConfig = typeof CONVERSION_BENCHMARKS

export interface AlertThresholdConfig {
  warning: number
  critical: number
}

export interface EffectiveRopSettings {
  departmentGoal: number | null
  conversionBenchmarks: ConversionBenchmarkConfig
  alertThresholds: AlertThresholdConfig
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
      departmentGoal: settings?.departmentGoal ? Number(settings.departmentGoal) : null,
      conversionBenchmarks,
      alertThresholds,
      activityScoreTarget: settings?.activityScoreTarget ?? KPI_BENCHMARKS.ACTIVITY_SCORE,
      northStarTarget: settings?.northStarTarget ?? KPI_BENCHMARKS.NORTH_STAR,
      salesPerDeal: settings?.salesPerDeal ? Number(settings.salesPerDeal) : PLAN_HEURISTICS.SALES_PER_DEAL,
      motivationGrades,
      periodStartDay: settings?.periodStartDay ?? 1,
    }
  }

  static async upsertSettings(managerId: string | null, payload: RopSettingsPayload) {
    const existing = await prisma.ropSettings.findFirst({
      where: { managerId: managerId ?? null },
    })

    const data: any = {}

    if (payload.departmentGoal !== undefined) data.departmentGoal = payload.departmentGoal
    if (payload.conversionBenchmarks) data.conversionBenchmarks = payload.conversionBenchmarks
    if (payload.alertThresholds) data.alertThresholds = payload.alertThresholds
    if (payload.activityScoreTarget !== undefined) data.activityScoreTarget = payload.activityScoreTarget
    if (payload.northStarTarget !== undefined) data.northStarTarget = payload.northStarTarget
    if (payload.salesPerDeal !== undefined) data.salesPerDeal = payload.salesPerDeal
    if (payload.motivationGrades) data.motivationGrades = payload.motivationGrades
    if (payload.periodStartDay !== undefined) data.periodStartDay = payload.periodStartDay

    if (existing) {
      return prisma.ropSettings.update({
        where: { id: existing.id },
        data,
      })
    }

    return prisma.ropSettings.create({
      data: {
        managerId,
        ...data,
      },
    })
  }
}
