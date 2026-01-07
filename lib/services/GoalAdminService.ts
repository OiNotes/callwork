import { prisma } from '@/lib/prisma'
import { AuditAction } from '@prisma/client'
import { roundMoney, toDecimal, toNumber } from '@/lib/utils/decimal'

export type GoalUpdateInput = {
  userId: string
  monthlyGoal: number | null
}

type GoalUpdateSource = 'manual' | 'import'

export class GoalAdminService {
  static async getTeamGoals(managerId: string) {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ id: managerId }, { managerId }],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        monthlyGoal: true,
      },
      orderBy: { name: 'asc' },
    })

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      monthlyGoal: toNumber(toDecimal(user.monthlyGoal)),
    }))
  }

  static async applyGoalUpdates(
    managerId: string,
    updates: GoalUpdateInput[],
    options: {
      source?: GoalUpdateSource
      ipAddress?: string | null
      userAgent?: string | null
    }
  ) {
    if (updates.length === 0) {
      return { updated: 0 }
    }

    const teamUsers = await prisma.user.findMany({
      where: {
        OR: [{ id: managerId }, { managerId }],
        isActive: true,
      },
      select: { id: true, monthlyGoal: true },
    })

    const teamMap = new Map(
      teamUsers.map((user) => [
        user.id,
        user.monthlyGoal === null ? null : toNumber(toDecimal(user.monthlyGoal)),
      ])
    )

    const uniqueUpdates = new Map<string, number | null>()
    for (const update of updates) {
      uniqueUpdates.set(update.userId, update.monthlyGoal)
    }

    const unauthorized = Array.from(uniqueUpdates.keys()).filter((userId) => !teamMap.has(userId))
    if (unauthorized.length > 0) {
      throw new Error('Forbidden')
    }

    const changes = Array.from(uniqueUpdates.entries())
      .map(([userId, monthlyGoal]) => {
        const previousGoal = teamMap.get(userId) ?? null
        const newGoal =
          monthlyGoal === null ? null : toNumber(roundMoney(toDecimal(monthlyGoal)))

        if ((previousGoal ?? 0) === (newGoal ?? 0)) {
          return null
        }

        return {
          userId,
          previousGoal,
          newGoal,
        }
      })
      .filter(
        (change): change is { userId: string; previousGoal: number | null; newGoal: number | null } =>
          Boolean(change)
      )

    if (changes.length === 0) {
      return { updated: 0 }
    }

    const source = options.source ?? 'manual'

    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.user.update({
          where: { id: change.userId },
          data: { monthlyGoal: change.newGoal },
        })

        await tx.auditLog.create({
          data: {
            action: AuditAction.GOAL_UPDATE,
            userId: managerId,
            targetUserId: change.userId,
            ipAddress: options.ipAddress ?? null,
            userAgent: options.userAgent ?? null,
            metadata: {
              previousGoal: change.previousGoal,
              newGoal: change.newGoal,
              source,
            },
          },
        })
      }
    })

    return { updated: changes.length }
  }

  static async getGoalHistory(
    managerId: string,
    options: { page?: number; limit?: number; userId?: string }
  ) {
    const teamUsers = await prisma.user.findMany({
      where: {
        OR: [{ id: managerId }, { managerId }],
        isActive: true,
      },
      select: { id: true },
    })

    const teamUserIds = new Set(teamUsers.map((user) => user.id))
    if (options.userId && !teamUserIds.has(options.userId)) {
      throw new Error('Forbidden')
    }

    const page = options.page ?? 1
    const limit = options.limit ?? 50
    const skip = (page - 1) * limit
    const targetUserIds = options.userId ? [options.userId] : Array.from(teamUserIds)

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: AuditAction.GOAL_UPDATE,
          targetUserId: { in: targetUserIds },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          action: true,
          userId: true,
          targetUserId: true,
          metadata: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          action: AuditAction.GOAL_UPDATE,
          targetUserId: { in: targetUserIds },
        },
      }),
    ])

    const targetIds = Array.from(
      new Set(logs.map((log) => log.targetUserId).filter(Boolean))
    )

    const targets = await prisma.user.findMany({
      where: { id: { in: targetIds as string[] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    const targetMap = new Map(targets.map((user) => [user.id, user]))

    return {
      items: logs.map((log) => ({
        ...log,
        targetUser: log.targetUserId ? targetMap.get(log.targetUserId) ?? null : null,
      })),
      total,
    }
  }
}
