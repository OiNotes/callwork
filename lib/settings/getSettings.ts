import { cache } from 'react'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { MOTIVATION_GRADE_PRESETS } from '@/lib/config/motivationGrades'
import { CONVERSION_BENCHMARKS } from '@/lib/config/conversionBenchmarks'
import { KPI_BENCHMARKS, PLAN_HEURISTICS } from '@/lib/config/metrics'
import { prisma } from '@/lib/prisma'
import type { AlertThresholdConfig, ConversionBenchmarkConfig } from '@/lib/services/RopSettingsService'
import type { MotivationGradeConfig } from '@/lib/config/motivationGrades'

export interface SettingsShape {
  conversionBenchmarks: ConversionBenchmarkConfig
  alertThresholds: AlertThresholdConfig
  activityTarget: number
  northStarTarget: number
  salesPerDeal: number
  funnelNorms: {
    zoomToPzm: number
    pzmToVzm: number
    vzmToContract: number
    contractToDeal: number
    zoomToDeal: number
  }
  benchmarks: {
    yellowThreshold: number
    redThreshold: number
    activity: number
    northStar: number
  }
  plans: {
    department: number
    managers: Record<string, number>
  }
  motivation: {
    grades: MotivationGradeConfig[]
    salesPerDeal: number
  }
  periodStartDay: number
}

const toNumber = (val: number | null | undefined, fallback: number) =>
  typeof val === 'number' && Number.isFinite(val) ? val : fallback

export const getSettings = cache(async (managerId?: string | null): Promise<SettingsShape> => {
  const settings = await RopSettingsService.getEffectiveSettings(managerId ?? null)
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true },
    select: { id: true, monthlyGoal: true },
  })

  const conversion = settings.conversionBenchmarks ?? CONVERSION_BENCHMARKS
  const alert = settings.alertThresholds

  return {
    conversionBenchmarks: conversion,
    alertThresholds: {
      warning: toNumber(alert.warning, 0.9),
      critical: toNumber(alert.critical, 0.7),
    },
    activityTarget: toNumber(settings.activityScoreTarget, KPI_BENCHMARKS.ACTIVITY_SCORE),
    northStarTarget: toNumber(settings.northStarTarget, KPI_BENCHMARKS.NORTH_STAR),
    salesPerDeal: toNumber(settings.salesPerDeal, PLAN_HEURISTICS.SALES_PER_DEAL),
    funnelNorms: {
      zoomToPzm: toNumber(conversion.BOOKED_TO_ZOOM1, CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1),
      pzmToVzm: toNumber(conversion.ZOOM1_TO_ZOOM2, CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2),
      vzmToContract: toNumber(conversion.ZOOM2_TO_CONTRACT, CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT),
      contractToDeal: toNumber(conversion.PUSH_TO_DEAL, CONVERSION_BENCHMARKS.PUSH_TO_DEAL),
      zoomToDeal: toNumber(conversion.ZOOM1_TO_DEAL_KPI, CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI),
    },
    benchmarks: {
      yellowThreshold: toNumber(alert.warning, 0.9),
      redThreshold: toNumber(alert.critical, 0.7),
      activity: toNumber(settings.activityScoreTarget, KPI_BENCHMARKS.ACTIVITY_SCORE),
      northStar: toNumber(settings.northStarTarget, KPI_BENCHMARKS.NORTH_STAR),
    },
    plans: {
      department: toNumber(settings.departmentGoal, 0),
      managers: managers.reduce<Record<string, number>>((acc, m) => {
        const val = m.monthlyGoal ? Number(m.monthlyGoal) : 0
        acc[m.id] = val
        return acc
      }, {}),
    },
    motivation: {
      grades: (settings.motivationGrades ?? MOTIVATION_GRADE_PRESETS).map((g) => ({
        minTurnover: Number(g.minTurnover ?? 0),
        maxTurnover:
          g.maxTurnover === null || g.maxTurnover === undefined ? null : Number(g.maxTurnover),
        commissionRate: Number(g.commissionRate ?? 0),
      })),
      salesPerDeal: toNumber(settings.salesPerDeal, PLAN_HEURISTICS.SALES_PER_DEAL),
    },
    periodStartDay: toNumber(settings.periodStartDay, 1),
  }
})
