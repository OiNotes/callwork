import { describe, it, expect } from 'vitest'
import { analyzeRedZones, getSeverityColor, getSeverityIcon } from '@/lib/analytics/recommendations'

describe('analyzeRedZones', () => {
  it('returns recommendations for low conversions', () => {
    const zones = analyzeRedZones({
      bookedToZoom1: 40,
      zoom1ToZoom2: 30,
      pushToDeal: 20,
      teamAverage: {
        bookedToZoom1: 60,
        zoom1ToZoom2: 55,
        pushToDeal: 50,
      },
    })

    expect(zones.length).toBeGreaterThan(0)
    expect(zones.some((zone) => zone.severity === 'critical' || zone.severity === 'warning')).toBe(true)
  })

  it('returns empty when conversions are good', () => {
    const zones = analyzeRedZones({
      bookedToZoom1: 95,
      zoom1ToZoom2: 90,
      pushToDeal: 85,
      teamAverage: {
        bookedToZoom1: 80,
        zoom1ToZoom2: 75,
        pushToDeal: 70,
      },
    })

    expect(zones).toEqual([])
  })
})

describe('severity helpers', () => {
  it('maps severity to color and icon', () => {
    expect(getSeverityColor('critical')).toContain('danger')
    expect(getSeverityIcon('warning')).toContain('warning')
    expect(getSeverityColor('ok')).toContain('success')
  })
})
