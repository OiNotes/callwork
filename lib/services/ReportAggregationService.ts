/**
 * ReportAggregationService - Единый источник правды для агрегации данных отчётов
 *
 * Этот сервис заменяет все дублирующиеся reduce/forEach/aggregate логики
 * и обеспечивает консистентность расчётов факта (revenue) во всём проекте.
 */

import { prisma } from '@/lib/db'
import Decimal from 'decimal.js'

export interface AggregationPeriod {
  startDate: Date
  endDate: Date
}

export interface ReportTotals {
  salesAmount: number
  zoomAppointments: number
  pzmConducted: number
  vzmConducted: number
  contractReviewCount: number
  pushCount: number
  successfulDeals: number
  refusalsCount: number
  warmingUpCount: number
}

export class ReportAggregationService {
  /**
   * Получить общую сумму продаж за период (единственный правильный способ!)
   *
   * @param userIds - ID пользователя или массив ID (для команды)
   * @param period - Период агрегации
   * @returns Сумма monthlySalesAmount в number (конвертировано из Decimal)
   */
  static async getTotalSales(
    userIds: string | string[],
    period: AggregationPeriod
  ): Promise<number> {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds]

    const result = await prisma.report.aggregate({
      where: {
        userId: { in: userIdArray },
        date: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      _sum: {
        monthlySalesAmount: true,
      },
    })

    // Конвертируем Decimal в number, защита от null
    return Number(result._sum.monthlySalesAmount || 0)
  }

  /**
   * Получить все агрегированные данные отчётов за период
   *
   * @param userIds - ID пользователя или массив ID
   * @param period - Период агрегации
   * @returns Объект с суммами всех метрик
   */
  static async getTotals(
    userIds: string | string[],
    period: AggregationPeriod
  ): Promise<ReportTotals> {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds]

    const result = await prisma.report.aggregate({
      where: {
        userId: { in: userIdArray },
        date: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      _sum: {
        monthlySalesAmount: true,
        zoomAppointments: true,
        pzmConducted: true,
        vzmConducted: true,
        contractReviewCount: true,
        pushCount: true,
        successfulDeals: true,
        refusalsCount: true,
        warmingUpCount: true,
      },
    })

    return {
      salesAmount: Number(result._sum.monthlySalesAmount || 0),
      zoomAppointments: result._sum.zoomAppointments || 0,
      pzmConducted: result._sum.pzmConducted || 0,
      vzmConducted: result._sum.vzmConducted || 0,
      contractReviewCount: result._sum.contractReviewCount || 0,
      pushCount: result._sum.pushCount || 0,
      successfulDeals: result._sum.successfulDeals || 0,
      refusalsCount: result._sum.refusalsCount || 0,
      warmingUpCount: result._sum.warmingUpCount || 0,
    }
  }

  /**
   * Получить ежедневные продажи за последние N дней
   * Полезно для weighted прогноза (последние дни важнее)
   *
   * @param userIds - ID пользователя или массив ID
   * @param days - Количество дней назад
   * @returns Массив { date, amount } отсортированный по дате
   */
  static async getDailySales(
    userIds: string | string[],
    days: number
  ): Promise<Array<{ date: Date; amount: number }>> {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const reports = await prisma.report.findMany({
      where: {
        userId: { in: userIdArray },
        date: { gte: startDate },
      },
      select: {
        date: true,
        monthlySalesAmount: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    return reports.map((report) => ({
      date: report.date,
      amount: Number(report.monthlySalesAmount),
    }))
  }

  /**
   * Получить средний размер сделки (средний чек)
   * Рассчитывается из исторических данных за последние 3 месяца
   *
   * @param userId - ID пользователя
   * @returns Средняя сумма одной сделки или null если нет данных
   */
  static async getAverageDealSize(userId: string): Promise<number | null> {
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const result = await prisma.report.aggregate({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
        successfulDeals: { gt: 0 }, // Только дни со сделками
      },
      _sum: {
        monthlySalesAmount: true,
        successfulDeals: true,
      },
    })

    const totalRevenue = Number(result._sum.monthlySalesAmount || 0)
    const totalDeals = result._sum.successfulDeals || 0

    if (totalDeals === 0) {
      return null // Нет исторических данных
    }

    return totalRevenue / totalDeals
  }

  /**
   * Получить средний чек для команды
   *
   * @param managerIdOrUserIds - ID менеджера или массив ID команды
   * @returns Средняя сумма одной сделки или null
   */
  static async getTeamAverageDealSize(
    managerIdOrUserIds: string | string[]
  ): Promise<number | null> {
    const userIds = Array.isArray(managerIdOrUserIds)
      ? managerIdOrUserIds
      : await this.getTeamUserIds(managerIdOrUserIds)

    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const result = await prisma.report.aggregate({
      where: {
        userId: { in: userIds },
        date: { gte: threeMonthsAgo },
        successfulDeals: { gt: 0 },
      },
      _sum: {
        monthlySalesAmount: true,
        successfulDeals: true,
      },
    })

    const totalRevenue = Number(result._sum.monthlySalesAmount || 0)
    const totalDeals = result._sum.successfulDeals || 0

    if (totalDeals === 0) {
      return null
    }

    return totalRevenue / totalDeals
  }

  /**
   * Вспомогательный метод: получить ID всех пользователей команды
   * (менеджер + активные сотрудники)
   */
  private static async getTeamUserIds(managerId: string): Promise<string[]> {
    const team = await prisma.user.findMany({
      where: {
        OR: [{ id: managerId }, { managerId: managerId }],
        isActive: true,
      },
      select: { id: true },
    })

    return team.map((user) => user.id)
  }
}
