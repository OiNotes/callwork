import { prisma } from '@/lib/prisma'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { toDecimal, sumDecimals, toNumber } from '@/lib/utils/decimal'

/**
 * GoalService - единый источник данных для целей продаж
 *
 * Обеспечивает консистентность данных между дашбордом, прогнозами и другими компонентами
 */
export class GoalService {
  /**
   * Получить месячную цель конкретного пользователя
   * @param userId - ID пользователя
   * @returns Цель пользователя в рублях или 0 если не установлена
   */
  static async getUserGoal(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyGoal: true }
    })

    return toNumber(toDecimal(user?.monthlyGoal))
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
    return goal > 0
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
}
