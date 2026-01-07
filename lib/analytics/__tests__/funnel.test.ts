import { describe, it, expect } from 'vitest'
import { calculateFullFunnel } from '@/lib/calculations/funnel'

describe('calculateFullFunnel', () => {
  it('calculates conversions and stages', () => {
    const result = calculateFullFunnel({
      zoomBooked: 100,
      zoom1Held: 50,
      zoom2Held: 25,
      contractReview: 10,
      push: 5,
      deals: 2,
      refusals: 4,
    })

    expect(result.funnel).toHaveLength(6)
    expect(result.funnel[0].conversion).toBe(100)
    expect(result.funnel[1].conversion).toBe(50)
    expect(result.funnel[2].conversion).toBe(50)
    expect(result.funnel[5].conversion).toBe(40)
  })

  it('handles empty totals', () => {
    const result = calculateFullFunnel({
      zoomBooked: 0,
      zoom1Held: 0,
      zoom2Held: 0,
      contractReview: 0,
      push: 0,
      deals: 0,
      refusals: 0,
    })

    expect(result.funnel.every((stage) => stage.value === 0)).toBe(true)
    expect(result.sideFlow.refusals.total).toBe(0)
    expect(result.northStarKpi.value).toBe(0)
  })

  it('calculates refusal breakdown with fallback', () => {
    const result = calculateFullFunnel({
      zoomBooked: 10,
      zoom1Held: 5,
      zoom2Held: 2,
      contractReview: 1,
      push: 1,
      deals: 1,
      refusals: 3,
    })

    const zoom1Refusal = result.sideFlow.refusals.byStage.find((stage) => stage.stageId === 'zoom1Held')
    expect(zoom1Refusal?.count).toBe(3)
  })
})
