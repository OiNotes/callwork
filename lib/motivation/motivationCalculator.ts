import { MOTIVATION_GRADE_PRESETS, MotivationGradeConfig } from '@/lib/config/motivationGrades'
import { roundMoney, toDecimal, toNumber, type Decimal } from '@/lib/utils/decimal'

export interface MotivationCalculationInput {
  factTurnover: number | string | Decimal
  hotTurnover: number | string | Decimal
  grades?: MotivationGradeConfig[]
  forecastWeight?: number
}

export interface MotivationCalculationResult {
  factTurnover: number
  hotTurnover: number
  forecastTurnover: number
  totalPotentialTurnover: number
  factRate: number
  forecastRate: number
  salaryFact: number
  salaryForecast: number
  potentialGain: number
}

const DEFAULT_FORECAST_WEIGHT = 0.5

export function resolveCommissionRate(
  turnover: number | string | Decimal,
  grades?: MotivationGradeConfig[]
): number {
  const source = grades && grades.length > 0 ? grades : MOTIVATION_GRADE_PRESETS
  const sorted = [...source].sort(
    (a, b) => toDecimal(a.minTurnover).comparedTo(toDecimal(b.minTurnover))
  )
  const turnoverValue = toDecimal(turnover)

  for (const grade of sorted) {
    const min = toDecimal(grade.minTurnover)
    const max = grade.maxTurnover === null || grade.maxTurnover === undefined
      ? null
      : toDecimal(grade.maxTurnover)
    const withinLowerBound = turnoverValue.greaterThanOrEqualTo(min)
    const withinUpperBound = max ? turnoverValue.lessThan(max) : true
    if (withinLowerBound && withinUpperBound) {
      return grade.commissionRate
    }
  }

  return sorted.length > 0 ? sorted[sorted.length - 1].commissionRate : 0
}

export function calculateMotivation(
  input: MotivationCalculationInput
): MotivationCalculationResult {
  const { factTurnover, hotTurnover, grades, forecastWeight = DEFAULT_FORECAST_WEIGHT } = input

  const safeFact = toDecimal(factTurnover)
  const safeHot = toDecimal(hotTurnover)

  const forecastTurnover = safeHot.times(forecastWeight)
  const totalPotentialTurnover = safeFact.plus(forecastTurnover)

  const factRate = resolveCommissionRate(safeFact, grades)
  const forecastRate = resolveCommissionRate(totalPotentialTurnover, grades)

  const salaryFact = safeFact.times(factRate)
  const salaryForecast = totalPotentialTurnover.times(forecastRate)
  const potentialGain = salaryForecast.minus(salaryFact)

  return {
    factTurnover: toNumber(roundMoney(safeFact)),
    hotTurnover: toNumber(roundMoney(safeHot)),
    forecastTurnover: toNumber(roundMoney(forecastTurnover)),
    totalPotentialTurnover: toNumber(roundMoney(totalPotentialTurnover)),
    factRate,
    forecastRate,
    salaryFact: toNumber(roundMoney(salaryFact)),
    salaryForecast: toNumber(roundMoney(salaryForecast)),
    potentialGain: toNumber(roundMoney(potentialGain)),
  }
}
