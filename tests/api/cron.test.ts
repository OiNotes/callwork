import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/cron/check-alerts/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'

vi.mock('@/app/api/sse/activities/route', () => ({
  broadcastActivity: vi.fn()
}))

vi.mock('@/lib/services/RopSettingsService', () => ({
  RopSettingsService: {
    getEffectiveSettings: vi.fn(async () => ({
      alertNoReportDays: 1,
      alertNoDealsDays: 1,
      alertConversionDrop: 0
    }))
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cron/check-alerts', () => {
  it('requires CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'secret'
    const req = createRequest('/api/cron/check-alerts')

    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('creates NO_REPORTS and NO_DEALS alerts', async () => {
    process.env.CRON_SECRET = 'secret'

    prismaMock.user.findMany
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          name: 'NoReports',
          reports: []
        },
        {
          id: 'user-2',
          name: 'NoDeals',
          reports: [
            {
              date: new Date(),
              successfulDeals: 0,
              vzmConducted: 1
            }
          ]
        }
      ])
      .mockResolvedValueOnce([
        { id: 'user-2', name: 'NoDeals' }
      ])

    prismaMock.alert.findMany.mockResolvedValueOnce([])
    prismaMock.alert.createMany.mockResolvedValueOnce({ count: 2 })

    const req = createRequest('/api/cron/check-alerts', {
      headers: { authorization: 'Bearer secret' }
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.created).toBe(2)

    const createCall = prismaMock.alert.createMany.mock.calls[0][0]
    const types = createCall.data.map((item: { type: string }) => item.type)
    expect(types).toContain('NO_REPORTS')
    expect(types).toContain('NO_DEALS')
  })

  it('does not duplicate existing alerts', async () => {
    process.env.CRON_SECRET = 'secret'

    prismaMock.user.findMany
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          name: 'NoReports',
          reports: []
        },
        {
          id: 'user-2',
          name: 'NoDeals',
          reports: [
            {
              date: new Date(),
              successfulDeals: 0,
              vzmConducted: 1
            }
          ]
        }
      ])
      .mockResolvedValueOnce([
        { id: 'user-2', name: 'NoDeals' }
      ])

    prismaMock.alert.findMany.mockResolvedValueOnce([
      { alertKey: 'no_reports:user-1' }
    ])
    prismaMock.alert.createMany.mockResolvedValueOnce({ count: 1 })

    const req = createRequest('/api/cron/check-alerts', {
      headers: { authorization: 'Bearer secret' }
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.created).toBe(1)
  })
})
