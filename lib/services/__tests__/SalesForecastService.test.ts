import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SalesForecastService } from '@/lib/services/SalesForecastService'
import { prismaMock } from '@/tests/mocks/prisma'
import { GoalService } from '@/lib/services/GoalService'

describe('SalesForecastService', () => {
  const service = new SalesForecastService()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 10))
  })

  it('forecasts end-of-month totals', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Manager' },
      { id: 'u2', name: 'Employee' },
    ] as never)
    prismaMock.report.findMany.mockResolvedValue([
      { date: new Date(2025, 0, 5), monthlySalesAmount: 10000, userId: 'u1' },
      { date: new Date(2025, 0, 6), monthlySalesAmount: 20000, userId: 'u2' },
    ] as never)

    vi.spyOn(GoalService, 'getTeamGoal').mockResolvedValue(100000)

    const result = await service.getDepartmentForecast('u1')

    expect(result.metrics.goal).toBe(100000)
    expect(result.chartData.length).toBeGreaterThan(0)
    expect(result.teamSize).toBe(2)
  })

  it('handles zero goal', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Manager' }] as never)
    prismaMock.report.findMany.mockResolvedValue([] as never)
    vi.spyOn(GoalService, 'getTeamGoal').mockResolvedValue(0)

    const result = await service.getDepartmentForecast('u1')
    expect(result.metrics.goal).toBe(0)
    expect(result.metrics.completion).toBe(0)
  })
})
