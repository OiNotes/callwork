import { cache } from 'react'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { MOTIVATION_GRADE_PRESETS } from '@/lib/config/motivationGrades'
import { CONVERSION_BENCHMARKS } from '@/lib/config/conversionBenchmarks'
import { KPI_BENCHMARKS, PLAN_HEURISTICS } from '@/lib/config/metrics'
import { prisma } from '@/lib/prisma'
import { GoalService } from '@/lib/services/GoalService'
import { toDecimal, toNumber as decimalToNumber } from '@/lib/utils/decimal'
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

const toFiniteNumber = (val: number | null | undefined, fallback: number) =>
  typeof val === 'number' && Number.isFinite(val) ? val : fallback

const SETTINGS_CACHE_TTL_MS = 60_000
const settingsCache = new Map<string, { value: SettingsShape; expiresAt: number }>()
const settingsInFlight = new Map<string, Promise<SettingsShape>>()

export const getSettings = cache(async (managerId?: string | null): Promise<SettingsShape> => {
  const settings = await RopSettingsService.getEffectiveSettings(managerId ?? null)
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true },
    select: { id: true },
  })
  const managerGoals = await GoalService.getUsersGoals(managers.map((m) => m.id))

  const conversion = settings.conversionBenchmarks ?? CONVERSION_BENCHMARKS
  const alert = settings.alertThresholds

  return {
    conversionBenchmarks: conversion,
    alertThresholds: {
      warning: toFiniteNumber(alert.warning, 0.9),
      critical: toFiniteNumber(alert.critical, 0.7),
    },
    activityTarget: toFiniteNumber(settings.activityScoreTarget, KPI_BENCHMARKS.ACTIVITY_SCORE),
    northStarTarget: toFiniteNumber(settings.northStarTarget, KPI_BENCHMARKS.NORTH_STAR),
    salesPerDeal: toFiniteNumber(settings.salesPerDeal, PLAN_HEURISTICS.SALES_PER_DEAL),
    funnelNorms: {
      zoomToPzm: toFiniteNumber(conversion.BOOKED_TO_ZOOM1, CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1),
      pzmToVzm: toFiniteNumber(conversion.ZOOM1_TO_ZOOM2, CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2),
      vzmToContract: toFiniteNumber(conversion.ZOOM2_TO_CONTRACT, CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT),
      contractToDeal: toFiniteNumber(conversion.PUSH_TO_DEAL, CONVERSION_BENCHMARKS.PUSH_TO_DEAL),
      zoomToDeal: toFiniteNumber(conversion.ZOOM1_TO_DEAL_KPI, CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI),
    },
    benchmarks: {
      yellowThreshold: toFiniteNumber(alert.warning, 0.9),
      redThreshold: toFiniteNumber(alert.critical, 0.7),
      activity: toFiniteNumber(settings.activityScoreTarget, KPI_BENCHMARKS.ACTIVITY_SCORE),
      northStar: toFiniteNumber(settings.northStarTarget, KPI_BENCHMARKS.NORTH_STAR),
    },
    plans: {
      department: decimalToNumber(toDecimal(settings.departmentGoal ?? 0)),
      managers: managers.reduce<Record<string, number>>((acc, m) => {
        acc[m.id] = managerGoals[m.id] ?? 0
        return acc
      }, {}),
    },
    motivation: {
      grades: (settings.motivationGrades ?? MOTIVATION_GRADE_PRESETS).map((g) => ({
        minTurnover: decimalToNumber(toDecimal(g.minTurnover ?? 0)),
        maxTurnover:
          g.maxTurnover === null || g.maxTurnover === undefined
            ? null
            : decimalToNumber(toDecimal(g.maxTurnover)),
        commissionRate: decimalToNumber(toDecimal(g.commissionRate ?? 0)),
      })),
      salesPerDeal: toFiniteNumber(settings.salesPerDeal, PLAN_HEURISTICS.SALES_PER_DEAL),
    },
    periodStartDay: toFiniteNumber(settings.periodStartDay, 1),
  }
})

export async function getSettingsCached(managerId?: string | null): Promise<SettingsShape> {
  const cacheKey = managerId ?? 'global'
  const now = Date.now()
  const cached = settingsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const inFlight = settingsInFlight.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const promise = getSettings(managerId)
    .then((value) => {
      settingsCache.set(cacheKey, { value, expiresAt: now + SETTINGS_CACHE_TTL_MS })
      settingsInFlight.delete(cacheKey)
      return value
    })
    .catch((error) => {
      settingsInFlight.delete(cacheKey)
      throw error
    })

  settingsInFlight.set(cacheKey, promise)
  return promise
}
