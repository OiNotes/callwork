import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastActivity } from '../../sse/activities/route'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { logError } from '@/lib/logger'

/**
 * Timing-safe сравнение Bearer token для защиты от timing attacks
 */
function verifyBearerToken(authHeader: string | null, secret: string | undefined): boolean {
  if (!authHeader || !secret) return false

  const prefix = 'Bearer '
  if (!authHeader.startsWith(prefix)) return false

  const providedToken = authHeader.slice(prefix.length)

  // Выравниваем буферы до одинаковой длины для timingSafeEqual
  const providedBuffer = Buffer.from(providedToken.padEnd(64, '\0'))
  const expectedBuffer = Buffer.from(secret.padEnd(64, '\0'))

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

type AlertCandidate = Prisma.AlertCreateManyInput & { alertKey: string }

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logError('CRON_SECRET environment variable is not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (!verifyBearerToken(request.headers.get('authorization'), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date()
    const settings = await RopSettingsService.getEffectiveSettings(null)
    const noReportDays = Math.max(0, settings.alertNoReportDays)
    const noDealsDays = Math.max(0, settings.alertNoDealsDays)
    const conversionDropPercent = Math.max(0, settings.alertConversionDrop)

    console.info('CRON check-alerts started', {
      at: today.toISOString(),
      noReportDays,
      noDealsDays,
      conversionDropPercent,
    })

    const candidates = new Map<string, AlertCandidate>()
    const addCandidate = (alertKey: string, data: Omit<AlertCandidate, 'alertKey'>) => {
      if (!candidates.has(alertKey)) {
        candidates.set(alertKey, { ...data, alertKey })
      }
    }

    const dateFilters: Date[] = []
    let noReportSince: Date | null = null
    let noDealsSince: Date | null = null
    let thisWeekStart: Date | null = null
    let lastWeekStart: Date | null = null
    let lastWeekEnd: Date | null = null

    if (noReportDays > 0) {
      noReportSince = new Date(today)
      noReportSince.setDate(today.getDate() - noReportDays)
      noReportSince.setHours(0, 0, 0, 0)
      dateFilters.push(noReportSince)
    }

    if (noDealsDays > 0) {
      noDealsSince = new Date(today)
      noDealsSince.setDate(today.getDate() - noDealsDays)
      noDealsSince.setHours(0, 0, 0, 0)
      dateFilters.push(noDealsSince)
    }

    if (conversionDropPercent > 0) {
      thisWeekStart = new Date(today)
      thisWeekStart.setDate(today.getDate() - today.getDay() + 1)
      thisWeekStart.setHours(0, 0, 0, 0)

      lastWeekStart = new Date(thisWeekStart)
      lastWeekStart.setDate(thisWeekStart.getDate() - 7)
      lastWeekEnd = new Date(thisWeekStart)
      lastWeekEnd.setMilliseconds(-1)

      dateFilters.push(lastWeekStart)
    }

    const earliestDate = dateFilters.length > 0
      ? new Date(Math.min(...dateFilters.map((d) => d.getTime())))
      : null

    const users = earliestDate
      ? await prisma.user.findMany({
          where: {
            role: 'EMPLOYEE',
            isActive: true,
          },
          include: {
            reports: {
              where: {
                date: { gte: earliestDate },
              },
            },
          },
        })
      : []

    if (noReportSince) {
      for (const user of users) {
        const recentReports = user.reports.filter((report) => report.date >= noReportSince!)
        if (recentReports.length === 0) {
          const alertKey = `no_reports:${user.id}`
          addCandidate(alertKey, {
            type: 'NO_REPORTS',
            severity: 'WARNING',
            title: `Нет отчётов ${noReportDays}+ дня`,
            description: `${user.name} не сдал отчёт за последние ${noReportDays} дня`,
            userId: user.id,
          })
        }
      }
    }

    if (noDealsSince) {
      for (const user of users) {
        const recentReports = user.reports.filter((report) => report.date >= noDealsSince!)
        const hasDeals = recentReports.some((report) => report.successfulDeals > 0)
        if (!hasDeals && recentReports.length > 0) {
          const alertKey = `no_deals:${user.id}`
          addCandidate(alertKey, {
            type: 'NO_DEALS',
            severity: 'CRITICAL',
            title: `Нет закрытых сделок ${noDealsDays}+ дней`,
            description: `${user.name} не закрыл ни одной сделки за последние ${noDealsDays} дней`,
            userId: user.id,
          })
        }
      }
    }

    if (conversionDropPercent > 0 && thisWeekStart && lastWeekStart && lastWeekEnd) {
      const dropMultiplier = Math.max(0, 1 - conversionDropPercent / 100)

      for (const user of users) {
        const thisWeekReports = user.reports.filter((report) => report.date >= thisWeekStart)
        const lastWeekReports = user.reports.filter(
          (report) => report.date >= lastWeekStart && report.date <= lastWeekEnd
        )

        if (thisWeekReports.length > 0 && lastWeekReports.length > 0) {
          const thisWeekDeals = thisWeekReports.reduce((sum, report) => sum + report.successfulDeals, 0)
          const thisWeekVzm = thisWeekReports.reduce((sum, report) => sum + report.vzmConducted, 0)
          const thisWeekConversion = thisWeekVzm > 0 ? (thisWeekDeals / thisWeekVzm) * 100 : 0

          const lastWeekDeals = lastWeekReports.reduce((sum, report) => sum + report.successfulDeals, 0)
          const lastWeekVzm = lastWeekReports.reduce((sum, report) => sum + report.vzmConducted, 0)
          const lastWeekConversion = lastWeekVzm > 0 ? (lastWeekDeals / lastWeekVzm) * 100 : 0

          if (lastWeekConversion > 0 && thisWeekConversion < lastWeekConversion * dropMultiplier) {
            const alertKey = `low_conversion:${user.id}:${thisWeekStart.toISOString().slice(0, 10)}`
            addCandidate(alertKey, {
              type: 'LOW_CONVERSION',
              severity: 'WARNING',
              title: 'Упала конверсия',
              description: `Конверсия ${user.name} упала с ${lastWeekConversion.toFixed(1)}% до ${thisWeekConversion.toFixed(1)}%`,
              userId: user.id,
            })
          }
        }
      }
    }

    const candidateAlerts = Array.from(candidates.values())
    const existingKeys = candidateAlerts.length
      ? await prisma.alert.findMany({
          where: {
            alertKey: { in: candidateAlerts.map((alert) => alert.alertKey) },
            isRead: false,
          },
          select: { alertKey: true },
        })
      : []

    const existingKeySet = new Set(existingKeys.map((alert) => alert.alertKey).filter(Boolean))
    const newAlerts = candidateAlerts.filter((alert) => !existingKeySet.has(alert.alertKey))

    if (newAlerts.length > 0) {
      await prisma.alert.createMany({ data: newAlerts })

      const criticalAlerts = newAlerts.filter((alert) => alert.severity === 'CRITICAL')
      if (criticalAlerts.length > 0) {
        const criticalUserIds = criticalAlerts
          .map((alert) => alert.userId)
          .filter((userId): userId is string => Boolean(userId))

        const criticalUsers = await prisma.user.findMany({
          where: { id: { in: criticalUserIds }, isActive: true },
          select: { id: true, name: true },
        })
        const nameById = new Map(criticalUsers.map((user) => [user.id, user.name]))

        for (const alert of criticalAlerts) {
          const userName = alert.userId ? nameById.get(alert.userId) : null
          if (userName && alert.userId) {
            broadcastActivity({
              type: 'alert',
              message: alert.title,
              details: alert.description ?? '',
              userId: alert.userId,
              userName,
            })
          }
        }
      }
    }

    console.info('CRON check-alerts completed', {
      created: newAlerts.length,
      skipped: existingKeySet.size,
      candidates: candidateAlerts.length,
    })

    return NextResponse.json({
      created: newAlerts.length,
      alerts: newAlerts.map((alert) => ({ type: alert.type, userId: alert.userId, alertKey: alert.alertKey })),
    })
  } catch (error) {
    logError('Cron check-alerts error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
