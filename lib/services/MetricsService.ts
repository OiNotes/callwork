/**
 * MetricsService - Единый источник правды для всех числовых метрик
 *
 * Этот сервис объединяет План, Факт и Прогноз в одном месте,
 * гарантируя консистентность расчётов во всём приложении.
 *
 * ИСПОЛЬЗОВАНИЕ:
 * - Вместо разрозненных вызовов GoalService + агрегации отчётов + calculateForecast
 * - Один метод getPlanVsFactVsForecast() возвращает всё сразу
 * - Все производные метрики (%, остаток, темп) считаются здесь
 */

import { GoalService } from './GoalService'
import { ReportAggregationService } from './ReportAggregationService'
import { calculateMonthlyForecast, calculateWeightedForecast } from '@/lib/calculations/forecast'
import { prisma } from '@/lib/db'

export interface PeriodMetrics {
  // План
  plan: number
  hasGoal: boolean // true если plan > 0 (цель установлена)

  // Факт
  fact: number

  // Прогноз
  forecast: {
    linear: number // Линейная экстраполяция
    weighted: number // Взвешенная (последние 7 дней важнее)
    optimistic: number // С учётом focus deals
  }

  // Производные метрики
  deltaToPlan: number // plan - fact (остаток до плана)
  percentageComplete: number // (fact / plan) * 100
  forecastVsPlan: {
    linear: number // (forecast.linear / plan) * 100
    weighted: number // (forecast.weighted / plan) * 100
    optimistic: number // (forecast.optimistic / plan) * 100
  }

  // Дополнительные данные для UI
  isAheadOfPace: boolean // Опережаем график или отстаём
  pacing: number // % опережения/отставания
  dailyRequired: number // Сколько нужно продавать в день для достижения плана
  averageDealSize: number | null // Средний чек (если есть история)
}

export class MetricsService {
  /**
   * ГЛАВНЫЙ МЕТОД: получить все метрики (план/факт/прогноз) за текущий месяц
   *
   * @param userId - ID пользователя
   * @returns Объект со всеми метриками
   */
  static async getPlanVsFactVsForecast(userId: string): Promise<PeriodMetrics> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    // Границы текущего месяца
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

    return this.getPlanVsFactVsForecastForPeriod(userId, startDate, endDate)
  }

  /**
   * Получить все метрики за произвольный период
   *
   * @param userId - ID пользователя
   * @param startDate - Начало периода
   * @param endDate - Конец периода
   * @returns Объект со всеми метриками
   */
  static async getPlanVsFactVsForecastForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PeriodMetrics> {
    // 1. Получаем план через GoalService (Single Source of Truth)
    const plan = await GoalService.getUserGoal(userId)
    const hasGoal = plan > 0

    // 2. Получаем факт через ReportAggregationService
    const fact = await ReportAggregationService.getTotalSales(userId, {
      startDate,
      endDate,
    })

    // 3. Получаем ежедневные продажи для weighted прогноза
    const now = new Date()
    const daysPassed = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const dailySales = await ReportAggregationService.getDailySales(
      userId,
      Math.max(daysPassed, 1)
    )

    // 4. Рассчитываем прогнозы
    const linearForecastData = calculateMonthlyForecast(fact, plan)
    const weightedForecastData = calculateWeightedForecast(dailySales, plan)

    // 5. Получаем focus deals для optimistic прогноза
    const focusDealsAmount = await this.getFocusDealsAmount(userId)
    const optimisticForecast = weightedForecastData.projectedTotal + focusDealsAmount

    // 6. Получаем средний чек
    const averageDealSize = await ReportAggregationService.getAverageDealSize(userId)

    // 7. Производные метрики
    const deltaToPlan = plan - fact
    const percentageComplete = plan > 0 ? (fact / plan) * 100 : 0

    const forecastVsPlan = {
      linear: plan > 0 ? (linearForecastData.projectedTotal / plan) * 100 : 0,
      weighted: plan > 0 ? (weightedForecastData.projectedTotal / plan) * 100 : 0,
      optimistic: plan > 0 ? (optimisticForecast / plan) * 100 : 0,
    }

    // 8. Темп выполнения (pacing)
    const isAheadOfPace = linearForecastData.pacing > 0
    const pacing = linearForecastData.pacing

    // 9. Дневная норма
    const dailyRequired = linearForecastData.dailyRequired

    return {
      plan,
      hasGoal,
      fact,
      forecast: {
        linear: linearForecastData.projectedTotal,
        weighted: weightedForecastData.projectedTotal,
        optimistic: optimisticForecast,
      },
      deltaToPlan,
      percentageComplete,
      forecastVsPlan,
      isAheadOfPace,
      pacing,
      dailyRequired,
      averageDealSize,
    }
  }

  /**
   * Получить метрики для команды (менеджер + сотрудники)
   *
   * @param managerId - ID менеджера
   * @returns Объект со всеми метриками для команды
   */
  static async getTeamMetrics(managerId: string): Promise<PeriodMetrics> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

    // Получаем ID всех членов команды
    const teamUserIds = await GoalService.getTeamUserIds(managerId)

    // 1. План команды
    const plan = await GoalService.getTeamGoal(managerId)
    const hasGoal = plan > 0

    // 2. Факт команды
    const fact = await ReportAggregationService.getTotalSales(teamUserIds, {
      startDate,
      endDate,
    })

    // 3. Ежедневные продажи команды
    const now2 = new Date()
    const daysPassed = Math.floor(
      (now2.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const dailySales = await ReportAggregationService.getDailySales(
      teamUserIds,
      Math.max(daysPassed, 1)
    )

    // 4. Прогнозы
    const linearForecastData = calculateMonthlyForecast(fact, plan)
    const weightedForecastData = calculateWeightedForecast(dailySales, plan)

    // 5. Focus deals команды
    const focusDealsAmount = await this.getTeamFocusDealsAmount(managerId)
    const optimisticForecast = weightedForecastData.projectedTotal + focusDealsAmount

    // 6. Средний чек команды
    const averageDealSize = await ReportAggregationService.getTeamAverageDealSize(
      teamUserIds
    )

    // 7. Производные метрики
    const deltaToPlan = plan - fact
    const percentageComplete = plan > 0 ? (fact / plan) * 100 : 0

    const forecastVsPlan = {
      linear: plan > 0 ? (linearForecastData.projectedTotal / plan) * 100 : 0,
      weighted: plan > 0 ? (weightedForecastData.projectedTotal / plan) * 100 : 0,
      optimistic: plan > 0 ? (optimisticForecast / plan) * 100 : 0,
    }

    const isAheadOfPace = linearForecastData.pacing > 0
    const pacing = linearForecastData.pacing
    const dailyRequired = linearForecastData.dailyRequired

    return {
      plan,
      hasGoal,
      fact,
      forecast: {
        linear: linearForecastData.projectedTotal,
        weighted: weightedForecastData.projectedTotal,
        optimistic: optimisticForecast,
      },
      deltaToPlan,
      percentageComplete,
      forecastVsPlan,
      isAheadOfPace,
      pacing,
      dailyRequired,
      averageDealSize,
    }
  }

  /**
   * Получить сумму всех focus deals пользователя
   */
  private static async getFocusDealsAmount(userId: string): Promise<number> {
    const result = await prisma.deal.aggregate({
      where: {
        managerId: userId,
        status: 'OPEN',
        isFocus: true,
      },
      _sum: {
        budget: true,
      },
    })

    return Number(result._sum.budget || 0)
  }

  /**
   * Получить сумму всех focus deals команды
   */
  private static async getTeamFocusDealsAmount(managerId: string): Promise<number> {
    const result = await prisma.deal.aggregate({
      where: {
        managerId,
        status: 'OPEN',
        isFocus: true,
      },
      _sum: {
        budget: true,
      },
    })

    return Number(result._sum.budget || 0)
  }
}
