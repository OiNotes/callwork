import { describe, it, expect } from 'vitest'
import { RopSettingsService } from '@/lib/services/RopSettingsService'
import { prismaMock } from '@/tests/mocks/prisma'

describe('RopSettingsService', () => {
  it('returns global settings when manager not provided', async () => {
    prismaMock.ropSettings.findFirst.mockResolvedValueOnce({
      departmentGoal: 500000,
      conversionBenchmarks: null,
      alertThresholds: null,
    } as never)

    const settings = await RopSettingsService.getEffectiveSettings(null)

    expect(settings.departmentGoal).toBe(500000)
    expect(settings.conversionBenchmarks.BOOKED_TO_ZOOM1).toBeDefined()
  })

  it('returns manager settings when available', async () => {
    prismaMock.ropSettings.findFirst
      .mockResolvedValueOnce({
        departmentGoal: 300000,
        conversionBenchmarks: { BOOKED_TO_ZOOM1: 75 },
        alertThresholds: { warning: 0.8, critical: 0.6 },
      } as never)
      .mockResolvedValueOnce({
        departmentGoal: 100000,
      } as never)

    const settings = await RopSettingsService.getEffectiveSettings('manager-1')

    expect(settings.departmentGoal).toBe(300000)
    expect(settings.conversionBenchmarks.BOOKED_TO_ZOOM1).toBe(75)
    expect(settings.alertThresholds.warning).toBe(0.8)
  })
})
