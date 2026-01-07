import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { getMotivationSummaryForManagers } from '@/lib/motivation/motivationService'
import { resolveAccessibleManagerIds } from '@/lib/motivation/scope'
import { getSettingsForUser } from '@/lib/settings/context'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

function getPeriod(params: { preset?: string; startDate?: string; endDate?: string }, customStartDay?: number) {
  const preset = params.preset
  const startParam = params.startDate
  const endParam = params.endDate

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

    const querySchema = z.object({
      preset: z.enum(['week', 'month']).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      managerId: z.union([z.literal('all'), z.string().cuid()]).optional(),
    })
    const parsedQuery = querySchema.safeParse({
      preset: searchParams.get('preset') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      managerId: searchParams.get('managerId') ?? undefined,
    })
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues }, { status: 400 })
    }

    const { preset, startDate, endDate, managerId } = parsedQuery.data
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: 'Invalid period range' }, { status: 400 })
    }

    const [{ settings }, managerIds] = await Promise.all([
      getSettingsForUser(user.id, user.role),
      resolveAccessibleManagerIds(user, managerId ?? null),
    ])

    const period = getPeriod({ preset, startDate, endDate }, settings.periodStartDay)
    const { summary, grades } = await getMotivationSummaryForManagers(
      managerIds,
      period,
      settings.motivation.grades
    )

    return jsonWithPrivateCache({
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
    logError('GET /api/motivation/summary error', error)

    // Различаем типы ошибок - не скрываем реальную причину
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
