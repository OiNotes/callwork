import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoalService } from '../GoalService'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock RopSettingsService
vi.mock('@/lib/services/RopSettingsService', () => ({
  RopSettingsService: {
    getEffectiveSettings: vi.fn().mockResolvedValue({ departmentGoal: null }),
  },
}))

describe('GoalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserGoal', () => {
    it('should return user monthly goal', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user1',
        monthlyGoal: new Decimal(100000),
      } as never)

      const goal = await GoalService.getUserGoal('user1')

      expect(goal).toBe(100000)
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user1', isActive: true },
        select: { monthlyGoal: true },
      })
    })

    it('should return null for user without goal', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user1',
        monthlyGoal: null,
      } as never)

      const goal = await GoalService.getUserGoal('user1')

      expect(goal).toBeNull()
    })

    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      const goal = await GoalService.getUserGoal('nonexistent')

      expect(goal).toBeNull()
    })
  })

  describe('getUsersGoals', () => {
    it('should return goals map for multiple users', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user1', monthlyGoal: new Decimal(100000) },
        { id: 'user2', monthlyGoal: new Decimal(150000) },
      ] as never)

      const goals = await GoalService.getUsersGoals(['user1', 'user2', 'user3'])

      expect(goals).toEqual({
        user1: 100000,
        user2: 150000,
        user3: 0, // Non-existent user gets 0
      })
    })

    it('should return empty object for empty input', async () => {
      const goals = await GoalService.getUsersGoals([])

      expect(goals).toEqual({})
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })
  })

  describe('getTeamGoal', () => {
    it('should return department goal if set in RopSettings', async () => {
      const { RopSettingsService } = await import('@/lib/services/RopSettingsService')
      vi.mocked(RopSettingsService.getEffectiveSettings).mockResolvedValue({
        departmentGoal: 500000,
      } as never)

      const goal = await GoalService.getTeamGoal('manager1')

      expect(goal).toBe(500000)
    })

    it('should sum team goals if no department goal', async () => {
      const { RopSettingsService } = await import('@/lib/services/RopSettingsService')
      vi.mocked(RopSettingsService.getEffectiveSettings).mockResolvedValue({
        departmentGoal: null,
      } as never)

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { monthlyGoal: new Decimal(100000) }, // Manager
        { monthlyGoal: new Decimal(80000) },  // Employee 1
        { monthlyGoal: new Decimal(120000) }, // Employee 2
      ] as never)

      const goal = await GoalService.getTeamGoal('manager1')

      expect(goal).toBe(300000)
    })
  })

  describe('hasGoal', () => {
    it('should return true if goal > 0', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        monthlyGoal: new Decimal(100000),
      } as never)

      const hasGoal = await GoalService.hasGoal('user1')

      expect(hasGoal).toBe(true)
    })

    it('should return false if goal is 0', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        monthlyGoal: new Decimal(0),
      } as never)

      const hasGoal = await GoalService.hasGoal('user1')

      expect(hasGoal).toBe(false)
    })

    it('should return false if goal is null', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        monthlyGoal: null,
      } as never)

      const hasGoal = await GoalService.hasGoal('user1')

      expect(hasGoal).toBe(false)
    })
  })

  describe('setUserGoal', () => {
    it('should update user goal with normalized value', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as never)

      await GoalService.setUserGoal('user1', 123456.789)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { monthlyGoal: expect.any(Number) },
      })

      // Check that value was rounded
      const call = vi.mocked(prisma.user.update).mock.calls[0][0]
      expect(call.data.monthlyGoal).toBeCloseTo(123456.79, 2)
    })

    it('should set goal to null when passed null', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as never)

      await GoalService.setUserGoal('user1', null)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { monthlyGoal: null },
      })
    })
  })

  describe('getTeamGoalBreakdown', () => {
    it('should return detailed team breakdown', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'manager1', name: 'Manager', role: 'MANAGER', monthlyGoal: new Decimal(200000) },
        { id: 'emp1', name: 'Employee 1', role: 'EMPLOYEE', monthlyGoal: new Decimal(100000) },
        { id: 'emp2', name: 'Employee 2', role: 'EMPLOYEE', monthlyGoal: null },
      ] as never)

      const breakdown = await GoalService.getTeamGoalBreakdown('manager1')

      expect(breakdown.totalGoal).toBe(300000)
      expect(breakdown.teamSize).toBe(3)
      expect(breakdown.usersWithGoals).toBe(2)
      expect(breakdown.usersWithoutGoals).toBe(1)
      expect(breakdown.breakdown).toHaveLength(3)
      expect(breakdown.breakdown[0]).toEqual({
        id: 'manager1',
        name: 'Manager',
        role: 'MANAGER',
        goal: 200000,
      })
    })
  })
})
