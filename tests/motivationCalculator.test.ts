import { describe, it, expect } from 'vitest'
import { calculateMotivation, resolveCommissionRate } from '@/lib/motivation/motivationCalculator'
import { MOTIVATION_GRADE_PRESETS } from '@/lib/config/motivationGrades'

describe('resolveCommissionRate', () => {
  it('should return 5% rate for 750k turnover', () => {
    const rate = resolveCommissionRate(750_000, MOTIVATION_GRADE_PRESETS)
    expect(rate).toBeCloseTo(0.05, 4)
  })

  it('should return 10% rate for top bracket (4.5M)', () => {
    const rateTop = resolveCommissionRate(4_500_000, MOTIVATION_GRADE_PRESETS)
    expect(rateTop).toBeCloseTo(0.1, 4)
  })
})

describe('calculateMotivation', () => {
  describe('core calculator math', () => {
    const result = calculateMotivation({
      factTurnover: 700_000,
      hotTurnover: 600_000,
      grades: MOTIVATION_GRADE_PRESETS,
    })

    it('should calculate forecast turnover (50% of hot)', () => {
      expect(result.forecastTurnover).toBe(300_000)
    })

    it('should calculate total potential turnover', () => {
      expect(result.totalPotentialTurnover).toBe(1_000_000)
    })

    it('should determine fact rate', () => {
      expect(result.factRate).toBeCloseTo(0.05, 4)
    })

    it('should determine forecast rate (1M tier)', () => {
      expect(result.forecastRate).toBeCloseTo(0.07, 4)
    })

    it('should calculate fact salary', () => {
      expect(result.salaryFact).toBeCloseTo(35_000, 0)
    })

    it('should calculate forecast salary', () => {
      expect(result.salaryForecast).toBeCloseTo(70_000, 0)
    })

    it('should calculate potential gain difference', () => {
      expect(result.potentialGain).toBeCloseTo(35_000, 0)
    })
  })

  describe('safe defaults on empty data', () => {
    const result = calculateMotivation({
      factTurnover: 0,
      hotTurnover: 0,
      grades: [],
    })

    it('should return zero potential when no turnover', () => {
      expect(result.totalPotentialTurnover).toBe(0)
    })

    it('should return zero salary forecast', () => {
      expect(result.salaryForecast).toBe(0)
    })
  })
})
