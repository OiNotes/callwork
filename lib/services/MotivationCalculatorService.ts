import { prisma } from '@/lib/prisma'
import { calculateMonthlyForecast } from '@/lib/calculations/forecast'
import { resolveCommissionRate } from '@/lib/motivation/motivationCalculator'
import type { MotivationGradeConfig } from '@/lib/config/motivationGrades'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { GoalService } from '@/lib/services/GoalService'
import { roundMoney, sumDecimals, toDecimal, toNumber } from '@/lib/utils/decimal'

interface MotivationGradeInput {
  minTurnover: number
  maxTurnover?: number | null
  commissionRate?: number | null
  percent?: number | null
}

export class MotivationCalculatorService {
  private getCommissionRate(turnover: number, grades: MotivationGradeInput[]): number {
    const normalized = grades.map((g) => ({
      minTurnover: g.minTurnover,
      maxTurnover: g.maxTurnover ?? null,
      commissionRate:
        typeof g.commissionRate === 'number'
          ? g.commissionRate
          : typeof g.percent === 'number'
            ? g.percent
            : 0,
    }))
    return resolveCommissionRate(turnover, normalized)
  }

  async calculateIncomeForecast(userId: string) {
    // 1. Get User & Goal
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, role: true, managerId: true }
    })

    if (!user) {
       const fallbackSettings = await RopSettingsService.getEffectiveSettings(null)
       // Return empty structure instead of crashing
       return {
         sales: { current: 0, projected: 0, optimistic: 0, goal: 0, focusDealsAmount: 0 },
         rates: { current: 0.05, projected: 0.05, optimistic: 0.05 },
         income: { current: 0, projected: 0, optimistic: 0, projectedGrowth: 0, potentialGrowth: 0 },
         grades: fallbackSettings.motivationGrades
       }
    }
    const managerScope = user.role === 'MANAGER' || user.role === 'ADMIN' ? user.id : user.managerId ?? null
    const settings = await RopSettingsService.getEffectiveSettings(managerScope)
    const motivationGrades = settings.motivationGrades
    const monthlyGoal = await GoalService.getUserGoal(userId)
    const goalValue = monthlyGoal ?? 0

    // 2. Get Current Sales (Fact)
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const reports = await prisma.report.findMany({
      where: {
        userId: userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: { monthlySalesAmount: true }
    })

    const currentSales = toNumber(sumDecimals(reports.map((r) => r.monthlySalesAmount)))

    // 3. Get Open Deals (Both Focus and Non-Focus)
    const openDeals = await prisma.deal.findMany({
      where: {
        managerId: userId,
        status: 'OPEN'
      },
      select: {
        id: true,
        title: true,
        budget: true,
        isFocus: true,
        createdAt: true
      },
      orderBy: { budget: 'desc' }
    })

    const focusDeals = openDeals.filter((deal) => deal.isFocus && toDecimal(deal.budget).greaterThan(0))
    const potentialFocusAmount = toNumber(
      sumDecimals(focusDeals.map((d) => d.budget))
    )

    // 4. Calculations
    
    // A. FACT
    const currentRate = this.getCommissionRate(currentSales, motivationGrades)
    const currentCommission = toDecimal(currentSales).times(currentRate)

    // B. FORECAST (Linear extrapolation)
    const forecastMetrics = calculateMonthlyForecast(currentSales, goalValue)
    const projectedSales = toDecimal(forecastMetrics.projected)
    const projectedRate = this.getCommissionRate(toNumber(projectedSales), motivationGrades)
    const projectedCommission = projectedSales.times(projectedRate)

    // C. POTENTIAL (Forecast + Focus Deals)
    // Assumption: Focus deals are closed ON TOP of the linear forecast? 
    // Or are they part of the "remaining" goal?
    // Usually, "Focus" means "I will close these specific deals".
    // Let's add them to the projected total to show "Optimistic" scenario.
    const optimisticSales = projectedSales.plus(potentialFocusAmount)
    const optimisticRate = this.getCommissionRate(toNumber(optimisticSales), motivationGrades)
    const optimisticCommission = optimisticSales.times(optimisticRate)

    return {
      sales: {
        current: toNumber(roundMoney(toDecimal(currentSales))),
        projected: toNumber(roundMoney(projectedSales)),
        optimistic: toNumber(roundMoney(optimisticSales)),
        goal: toNumber(roundMoney(toDecimal(goalValue))),
        focusDealsAmount: toNumber(roundMoney(toDecimal(potentialFocusAmount)))
      },
      rates: {
        current: currentRate,
        projected: projectedRate,
        optimistic: optimisticRate
      },
      income: {
        current: toNumber(roundMoney(currentCommission)),
        projected: toNumber(roundMoney(projectedCommission)),
        optimistic: toNumber(roundMoney(optimisticCommission)),
        projectedGrowth: toNumber(roundMoney(projectedCommission.minus(currentCommission))),
        potentialGrowth: toNumber(roundMoney(optimisticCommission.minus(projectedCommission)))
      },
      grades: motivationGrades.map((g) => ({ min: g.minTurnover, percent: g.commissionRate })),
      deals: openDeals // Return the list for the UI
    }
  }
}
