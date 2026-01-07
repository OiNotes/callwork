import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateMonthlyForecast, generateForecastChartData } from '../forecast'

describe('calculateMonthlyForecast', () => {
  // Mock Date to control "today"
  const mockDate = new Date(2025, 0, 15) // January 15, 2025 (middle of month)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should calculate basic forecast metrics', () => {
    const result = calculateMonthlyForecast(150000, 300000)

    // January 2025 has 31 days
    expect(result.daysInMonth).toBe(31)
    expect(result.daysPassed).toBe(15)
    expect(result.daysRemaining).toBe(16)

    // Current sales and goal
    expect(result.current).toBe(150000)
    expect(result.goal).toBe(300000)

    // Daily average: 150000 / 15 = 10000
    expect(result.dailyAverage).toBe(10000)

    // Projected: 10000 * 31 = 310000
    expect(result.projected).toBe(310000)

    // Completion: 310000 / 300000 * 100 = 103.33%
    expect(result.completion).toBe(103)
  })

  it('should calculate pacing correctly when ahead of plan', () => {
    // Goal: 300000 for January
    // Expected by day 15: 300000 / 31 * 15 = 145161.29
    // Current sales: 150000
    // Pacing: (150000 - 145161) / 145161 * 100 = 3.33%
    const result = calculateMonthlyForecast(150000, 300000)

    expect(result.isPacingGood).toBe(true)
    expect(result.pacing).toBeGreaterThan(0)
  })

  it('should calculate pacing correctly when behind plan', () => {
    // Goal: 300000 for January
    // Expected by day 15: 300000 / 31 * 15 = 145161.29
    // Current sales: 100000
    // Pacing: (100000 - 145161) / 145161 * 100 = -31.1%
    const result = calculateMonthlyForecast(100000, 300000)

    expect(result.isPacingGood).toBe(false)
    expect(result.pacing).toBeLessThan(0)
  })

  it('should calculate daily required correctly', () => {
    // Need 300000 - 150000 = 150000 more
    // Days remaining: 16
    // Daily required: 150000 / 16 = 9375
    const result = calculateMonthlyForecast(150000, 300000)

    expect(result.dailyRequired).toBe(9375)
  })

  it('should handle zero goal gracefully', () => {
    const result = calculateMonthlyForecast(50000, 0)

    expect(result.completion).toBe(0)
    expect(result.goal).toBe(0)
    expect(result.projected).toBeGreaterThan(0)
  })

  it('should handle zero sales gracefully', () => {
    const result = calculateMonthlyForecast(0, 300000)

    expect(result.dailyAverage).toBe(0)
    expect(result.projected).toBe(0)
    expect(result.completion).toBe(0)
    expect(result.isPacingGood).toBe(false)
  })

  it('should handle last day of month', () => {
    // Set to last day of January
    vi.setSystemTime(new Date(2025, 0, 31))

    const result = calculateMonthlyForecast(300000, 300000)

    expect(result.daysRemaining).toBe(0)
    expect(result.dailyRequired).toBe(0) // Division by 0 protection
    expect(result.completion).toBe(100)
  })

  it('should handle first day of month', () => {
    vi.setSystemTime(new Date(2025, 0, 1))

    const result = calculateMonthlyForecast(10000, 300000)

    expect(result.daysPassed).toBe(1)
    expect(result.daysRemaining).toBe(30)
    expect(result.dailyAverage).toBe(10000)
  })

  it('should handle February (28/29 days)', () => {
    vi.setSystemTime(new Date(2025, 1, 14)) // February 14, 2025

    const result = calculateMonthlyForecast(100000, 280000)

    expect(result.daysInMonth).toBe(28) // 2025 is not a leap year
    expect(result.daysPassed).toBe(14)
    expect(result.daysRemaining).toBe(14)
  })

  it('should handle leap year February', () => {
    vi.setSystemTime(new Date(2024, 1, 15)) // February 15, 2024 (leap year)

    const result = calculateMonthlyForecast(150000, 290000)

    expect(result.daysInMonth).toBe(29)
  })
})

describe('generateForecastChartData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15)) // January 15, 2025
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should generate data points for entire month', () => {
    const data = generateForecastChartData(150000, 300000)

    expect(data).toHaveLength(31) // January has 31 days
    expect(data[0].day).toBe(1)
    expect(data[30].day).toBe(31)
  })

  it('should have plan values for all days', () => {
    const data = generateForecastChartData(150000, 300000)

    data.forEach(point => {
      expect(point.plan).toBeDefined()
      expect(point.plan).toBeGreaterThanOrEqual(0)
    })

    // Plan should be cumulative
    expect(data[30].plan).toBe(300000) // Full goal at end of month
  })

  it('should have actual values only up to current day', () => {
    const data = generateForecastChartData(150000, 300000)

    // Days 1-15 should have actual values
    for (let i = 0; i < 15; i++) {
      expect(data[i].actual).toBeDefined()
    }

    // Days 16-31 should NOT have actual values
    for (let i = 15; i < 31; i++) {
      expect(data[i].actual).toBeUndefined()
    }
  })

  it('should have forecast values only after current day', () => {
    const data = generateForecastChartData(150000, 300000)

    // Days 1-15 should NOT have forecast values
    for (let i = 0; i < 15; i++) {
      expect(data[i].forecast).toBeUndefined()
    }

    // Days 16-31 should have forecast values
    for (let i = 15; i < 31; i++) {
      expect(data[i].forecast).toBeDefined()
    }
  })

  it('should use provided daily sales data', () => {
    const dailySales = [
      { day: 1, sales: 10000 },
      { day: 2, sales: 15000 },
      { day: 3, sales: 5000 },
    ]

    vi.setSystemTime(new Date(2025, 0, 3))
    const data = generateForecastChartData(30000, 300000, dailySales)

    // Cumulative sales
    expect(data[0].actual).toBe(10000)
    expect(data[1].actual).toBe(25000) // 10000 + 15000
    expect(data[2].actual).toBe(30000) // 10000 + 15000 + 5000
  })

  it('should handle empty daily sales array', () => {
    const data = generateForecastChartData(150000, 300000, [])

    // Should still generate data using uniform distribution
    expect(data).toHaveLength(31)
    expect(data[14].actual).toBeDefined()
  })

  it('should handle zero sales', () => {
    const data = generateForecastChartData(0, 300000)

    // All actual values should be 0
    for (let i = 0; i < 15; i++) {
      expect(data[i].actual).toBe(0)
    }

    // All forecast values should be 0
    for (let i = 15; i < 31; i++) {
      expect(data[i].forecast).toBe(0)
    }
  })
})
