import {
  CONVERSION_BENCHMARKS,
  FUNNEL_STAGES,
  type FunnelStageMeta,
} from './conversionBenchmarks'

/**
 * Единый центр правды для конверсий и KPI.
 * Весь код должен ссылаться на эти константы/структуры, а не держать магические числа локально.
 */
export const METRIC_BENCHMARKS = {
  ...CONVERSION_BENCHMARKS,
  ACTIVITY_SCORE: 80,
}

export const KPI_BENCHMARKS = {
  NORTH_STAR: CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI,
  ACTIVITY_SCORE: 80,
}

// Плановая эвристика: сколько продаж (₽) в среднем приходится на одну сделку — используется для оценки плановых сделок
export const PLAN_HEURISTICS = {
  SALES_PER_DEAL: 100_000,
}

export { CONVERSION_BENCHMARKS, FUNNEL_STAGES }
export type { FunnelStageMeta }
