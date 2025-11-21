import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { getMotivationSummaryForManagers } from '@/lib/motivation/motivationService'
import { resolveAccessibleManagerIds } from '@/lib/motivation/scope'
import { getSettingsForUser } from '@/lib/settings/context'

function getPeriod(searchParams: URLSearchParams, customStartDay?: number) {
  const preset = searchParams.get('preset')
  const startParam = searchParams.get('startDate')
  const endParam = searchParams.get('endDate')

  const now = new Date()
  let startDate: Date
  let endDate: Date

  if (startParam && endParam && !Number.isNaN(Date.parse(startParam)) && !Number.isNaN(Date.parse(endParam))) {
    startDate = new Date(startParam)
    endDate = new Date(endParam)
  } else if (preset === 'week') {
    endDate = now
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 7)
  } else {
    endDate = now
    const startDay =
      typeof customStartDay === 'number' && customStartDay > 0 && customStartDay <= 31
        ? customStartDay
        : 1
    startDate = new Date(now.getFullYear(), now.getMonth(), startDay)
    if (startDay > now.getDate()) {
      startDate.setMonth(startDate.getMonth() - 1)
    }
  }

  return { startDate, endDate }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get('managerId')
    const { settings } = await getSettingsForUser(user.id, user.role)

    const period = getPeriod(searchParams, settings.periodStartDay)
    const managerIds = await resolveAccessibleManagerIds(user, managerId)
    const { summary, grades } = await getMotivationSummaryForManagers(
      managerIds,
      period,
      settings.motivation.grades
    )

    return NextResponse.json({
      factTurnover: summary.factTurnover,
      hotTurnover: summary.hotTurnover,
      forecastTurnover: summary.forecastTurnover,
      totalPotentialTurnover: summary.totalPotentialTurnover,
      factRate: summary.factRate,
      forecastRate: summary.forecastRate,
      salaryFact: summary.salaryFact,
      salaryForecast: summary.salaryForecast,
      potentialGain: summary.potentialGain,
      grades,
      managerIds,
      period: {
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/motivation/summary error', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
