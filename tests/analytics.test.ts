import { describe, it, expect } from 'vitest'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { CONVERSION_BENCHMARKS } from '@/lib/config/benchmarks'

describe('calculateFullFunnel', () => {
  describe('step-to-step conversion and KPI', () => {
    const { funnel, northStarKpi } = calculateFullFunnel({
      zoomBooked: 10,
      zoom1Held: 8,
      zoom2Held: 4,
      contractReview: 3,
      push: 2,
      deals: 1,
    })

    it('should calculate zoom1 conversion (Запись → 1-й Zoom)', () => {
      expect(funnel.find((s) => s.id === 'zoom1Held')?.conversion).toBeCloseTo(80, 0)
    })

    it('should calculate zoom2 conversion (1-й → 2-й Zoom)', () => {
      expect(funnel.find((s) => s.id === 'zoom2Held')?.conversion).toBeCloseTo(50, 0)
    })

    it('should calculate contract conversion (2-й → Договор)', () => {
      expect(funnel.find((s) => s.id === 'contractReview')?.conversion).toBeCloseTo(75, 0)
    })

    it('should calculate push conversion (Договор → Дожим)', () => {
      expect(funnel.find((s) => s.id === 'push')?.conversion).toBeCloseTo(66.67, 0)
    })

    it('should calculate deal conversion (Дожим → Оплата)', () => {
      expect(funnel.find((s) => s.id === 'deal')?.conversion).toBeCloseTo(50, 0)
    })

    it('should calculate North Star KPI (оплаты / 1-й Zoom)', () => {
      expect(northStarKpi.value).toBeCloseTo(12.5, 1)
    })

    it('should set correct North Star target', () => {
      expect(northStarKpi.target).toBe(CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI)
    })
  })

  describe('refusals aggregation by stage', () => {
    const { sideFlow } = calculateFullFunnel({
      zoomBooked: 20,
      zoom1Held: 10,
      zoom2Held: 5,
      contractReview: 3,
      push: 2,
      deals: 1,
      refusalByStage: { zoom1Held: 2, zoom2Held: 1, contractReview: 1, push: 0 },
    })

    it('should calculate total refusals', () => {
      expect(sideFlow.refusals.total).toBe(4)
    })

    it('should calculate zoom1 refusal rate', () => {
      const zoom1Refusal = sideFlow.refusals.byStage.find((s) => s.stageId === 'zoom1Held')
      expect(zoom1Refusal?.rate).toBeCloseTo(20, 0)
    })
  })
})
