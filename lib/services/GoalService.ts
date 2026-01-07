import { prisma } from '@/lib/prisma'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { roundMoney, toDecimal, sumDecimals, toNumber } from '@/lib/utils/decimal'

/**
 * GoalService - единый источник данных для целей продаж
 *
 * Обеспечивает консистентность данных между дашбордом, прогнозами и другими компонентами
 */
export class GoalService {
  /**
   * Получить месячную цель конкретного пользователя
   * @param userId - ID пользователя
   * @returns Цель пользователя в рублях или null если не установлена
   */
  static async getUserGoal(userId: string): Promise<number | null> {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { monthlyGoal: true }
    })

    if (!user || user.monthlyGoal === null) {
      return null
    }

    return toNumber(toDecimal(user.monthlyGoal))
  }

  /**
   * Получить цели для набора пользователей (без неактивных)
   * @param userIds - список ID пользователей
   * @returns Map userId -> goal (0 если отсутствует или неактивен)
   */
  static async getUsersGoals(userIds: string[]): Promise<Record<string, number>> {
    if (userIds.length === 0) {
      return {}
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, monthlyGoal: true },
    })

    const goalsById = new Map(users.map((u) => [u.id, toNumber(toDecimal(u.monthlyGoal))]))
    return userIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = goalsById.get(id) ?? 0
      return acc
    }, {})
  }

  /**
   * Получить суммарную цель команды для менеджера
   * Включает цель самого менеджера + всех его активных сотрудников
   *
   * @param managerId - ID менеджера
   * @returns Суммарная цель команды в рублях
   */
  static async getTeamGoal(managerId: string): Promise<number> {
    const settings = await RopSettingsService.getEffectiveSettings(managerId)
    if (settings.departmentGoal && settings.departmentGoal > 0) {
      return settings.departmentGoal
    }

    const team = await prisma.user.findMany({
      where: {
        OR: [
          { id: managerId }, // Сам менеджер
          { managerId: managerId } // Его сотрудники
        ],
        isActive: true // Только активные
      },
      select: { monthlyGoal: true }
    })

    return toNumber(sumDecimals(team.map(u => u.monthlyGoal)))
  }

  /**
   * Проверить, установлена ли цель у пользователя
   * @param userId - ID пользователя
   * @returns true если цель установлена и > 0
   */
  static async hasGoal(userId: string): Promise<boolean> {
    const goal = await this.getUserGoal(userId)
    return goal !== null && goal > 0
  }

  /**
   * Получить информацию о целях для команды
   * @param managerId - ID менеджера
   * @returns Детальная информация о целях команды
   */
  static async getTeamGoalBreakdown(managerId: string) {
    const team = await prisma.user.findMany({
      where: {
        OR: [
          { id: managerId },
          { managerId: managerId }
        ],
        isActive: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        monthlyGoal: true
      }
    })

    const totalGoal = toNumber(sumDecimals(team.map(u => u.monthlyGoal)))
    const usersWithGoals = team.filter(user => toDecimal(user.monthlyGoal).greaterThan(0))

    return {
      totalGoal,
      teamSize: team.length,
      usersWithGoals: usersWithGoals.length,
      usersWithoutGoals: team.length - usersWithGoals.length,
      breakdown: team.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        goal: toNumber(toDecimal(user.monthlyGoal))
      }))
    }
  }

  /**
   * Установить месячную цель пользователя (с нормализацией в Decimal).
   * @param userId - ID пользователя
   * @param monthlyGoal - новая цель или null для сброса
   */
  static async setUserGoal(userId: string, monthlyGoal: number | null): Promise<void> {
    const normalized = monthlyGoal === null ? null : toNumber(roundMoney(toDecimal(monthlyGoal)))
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyGoal: normalized },
    })
  }
}
