import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MotivationCalculatorService } from '@/lib/services/MotivationCalculatorService'
import { prismaMock } from '@/tests/mocks/prisma'
import { GoalService } from '@/lib/services/GoalService'
import { RopSettingsService } from '@/lib/services/RopSettingsService'

describe('MotivationCalculatorService', () => {
  const service = new MotivationCalculatorService()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15))
  })

  it('calculates current and forecast commission', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      managerId: null,
      isActive: true,
    } as never)
    prismaMock.report.findMany.mockResolvedValue([
      { monthlySalesAmount: 50000 },
      { monthlySalesAmount: 50000 },
    ] as never)
    prismaMock.deal.findMany.mockResolvedValue([] as never)

    vi.spyOn(GoalService, 'getUserGoal').mockResolvedValue(200000)
    vi.spyOn(RopSettingsService, 'getEffectiveSettings').mockResolvedValue({
      motivationGrades: [
        { minTurnover: 0, maxTurnover: 100000, commissionRate: 0.1 },
        { minTurnover: 100000, maxTurnover: null, commissionRate: 0.2 },
      ],
    } as never)

    const result = await service.calculateIncomeForecast('user-1')

    expect(result.sales.current).toBe(100000)
    expect(result.sales.goal).toBe(200000)
    expect(result.rates.current).toBe(0.2)
    expect(result.income.current).toBeGreaterThan(0)
  })

  it('includes focus deals in optimistic scenario and skips zero budgets', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      managerId: null,
      isActive: true,
    } as never)
    prismaMock.report.findMany.mockResolvedValue([
      { monthlySalesAmount: 50000 },
    ] as never)
    prismaMock.deal.findMany.mockResolvedValue([
      { id: 'd1', budget: 100000, isFocus: true, createdAt: new Date() },
      { id: 'd2', budget: 0, isFocus: true, createdAt: new Date() },
    ] as never)

    vi.spyOn(GoalService, 'getUserGoal').mockResolvedValue(150000)
    vi.spyOn(RopSettingsService, 'getEffectiveSettings').mockResolvedValue({
      motivationGrades: [{ minTurnover: 0, maxTurnover: null, commissionRate: 0.1 }],
    } as never)

    const result = await service.calculateIncomeForecast('user-1')

    expect(result.sales.optimistic).toBeGreaterThan(result.sales.projected)
    expect(result.sales.focusDealsAmount).toBe(100000)
  })

  it('handles empty grades', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      managerId: null,
      isActive: true,
    } as never)
    prismaMock.report.findMany.mockResolvedValue([] as never)
    prismaMock.deal.findMany.mockResolvedValue([] as never)

    vi.spyOn(GoalService, 'getUserGoal').mockResolvedValue(0)
    vi.spyOn(RopSettingsService, 'getEffectiveSettings').mockResolvedValue({
      motivationGrades: [],
    } as never)

    const result = await service.calculateIncomeForecast('user-1')
    expect(result.rates.current).toBeGreaterThanOrEqual(0)
  })
})
