import { Report } from '@prisma/client'
import type { ManagerStats } from '@/lib/analytics/funnel.client'
import { GoalService } from '@/lib/services/GoalService'
import { computeConversions } from '@/lib/calculations/metrics'
import { PLAN_HEURISTICS } from '@/lib/config/metrics'

// Re-export types and client functions from funnel.client.ts
export type { ManagerStats, FunnelStage } from '@/lib/analytics/funnel.client'
export { BENCHMARKS, getHeatmapColor, getFunnelData, analyzeRedZones, calculateManagerStatsClient } from '@/lib/analytics/funnel.client'

/**
 * Server-side версия calculateManagerStats с получением целей из БД
 * Требует managerId для запроса к базе данных
 *
 * ВАЖНО: Эта функция только для серверных компонентов/API routes!
 * Для клиентских компонентов используйте calculateManagerStatsClient из '@/lib/analytics/funnel.client'
 */
export async function calculateManagerStats(
  reports: Report[],
  managerId: string
): Promise<Omit<ManagerStats, 'id' | 'name'>> {
  const totals = reports.reduce(
    (acc, report) => {
      const pushCount = (report as any).pushCount ?? report.contractReviewCount ?? 0

      return {
        zoomBooked: acc.zoomBooked + report.zoomAppointments,
        zoom1Held: acc.zoom1Held + report.pzmConducted,
        zoom2Held: acc.zoom2Held + report.vzmConducted,
        contractReview: acc.contractReview + report.contractReviewCount,
        pushCount: acc.pushCount + pushCount,
        successfulDeals: acc.successfulDeals + report.successfulDeals,
        salesAmount: acc.salesAmount + Number(report.monthlySalesAmount),
        refusals: acc.refusals + (report.refusalsCount || 0),
        warming: acc.warming + (report.warmingUpCount || 0),
      }
    },
    {
      zoomBooked: 0,
      zoom1Held: 0,
      zoom2Held: 0,
      contractReview: 0,
      pushCount: 0,
      successfulDeals: 0,
      salesAmount: 0,
      refusals: 0,
      warming: 0,
    }
  )

  const { stages, northStar, totalConversion } = computeConversions({
    zoomBooked: totals.zoomBooked,
    zoom1Held: totals.zoom1Held,
    zoom2Held: totals.zoom2Held,
    contractReview: totals.contractReview,
    push: totals.pushCount,
    deals: totals.successfulDeals,
  })
  const convMap = Object.fromEntries(stages.map((stage) => [stage.id, stage.conversion]))

  // Получаем цель из БД через единый источник данных
  const planSales = await GoalService.getTeamGoal(managerId)
  const planDeals = Math.max(1, Math.round(planSales / PLAN_HEURISTICS.SALES_PER_DEAL))

  // Рассчитываем активность на основе реальных данных
  const expectedActivity = totals.zoomBooked > 0 ? 100 : 0
  const actualActivity = Math.min(
    100,
    Math.round((totals.zoom1Held / Math.max(1, totals.zoomBooked)) * 100)
  )
  const activityScore = Math.round((expectedActivity + actualActivity) / 2)

  // Определяем тренд на основе прогресса к цели
  const progress = planSales > 0 ? (totals.salesAmount / planSales) * 100 : 0
  const trend = progress >= 80 ? 'up' : progress >= 50 ? 'flat' : 'down'

  return {
    ...totals,
    bookedToZoom1: (convMap.zoom1Held as number) || 0,
    zoom1ToZoom2: (convMap.zoom2Held as number) || 0,
    zoom2ToContract: (convMap.contractReview as number) || 0,
    contractToPush: (convMap.push as number) || 0,
    pushToDeal: (convMap.deal as number) || 0,
    northStar,
    totalConversion,
    planSales,
    planDeals,
    activityScore,
    trend,
  }
}
