import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/reports/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireAuth } from '@/lib/auth/get-session'

vi.mock('@/app/api/sse/deals/route', () => ({
  broadcastDeal: vi.fn()
}))

vi.mock('@/app/api/sse/activities/route', () => ({
  broadcastActivity: vi.fn()
}))

const csrfHeaders = {
  origin: 'http://localhost',
  host: 'localhost'
}

const baseReportBody = {
  date: new Date().toISOString(),
  zoomAppointments: 10,
  pzmConducted: 8,
  refusalsCount: 0,
  warmingUpCount: 2,
  vzmConducted: 6,
  contractReviewCount: 4,
  pushCount: 3,
  successfulDeals: 2,
  monthlySalesAmount: '1000',
  comment: 'OK'
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({
    id: 'user-1',
    role: 'EMPLOYEE',
    name: 'User One',
    email: 'user@example.com'
  })
  prismaMock.report.findMany.mockResolvedValue([])
  prismaMock.report.count.mockResolvedValue(0)
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
  prismaMock.report.findUnique.mockResolvedValue(null)
  prismaMock.report.create.mockResolvedValue({
    id: 'report-1',
    userId: 'user-1',
    date: new Date(baseReportBody.date),
    zoomAppointments: baseReportBody.zoomAppointments,
    pzmConducted: baseReportBody.pzmConducted,
    refusalsCount: baseReportBody.refusalsCount,
    warmingUpCount: baseReportBody.warmingUpCount,
    vzmConducted: baseReportBody.vzmConducted,
    contractReviewCount: baseReportBody.contractReviewCount,
    pushCount: baseReportBody.pushCount,
    successfulDeals: baseReportBody.successfulDeals,
    monthlySalesAmount: baseReportBody.monthlySalesAmount,
    comment: baseReportBody.comment
  })
})

describe('GET /api/reports', () => {
  it('returns reports for the user', async () => {
    prismaMock.report.findMany.mockResolvedValueOnce([
      {
        id: 'report-1',
        userId: 'user-1',
        date: new Date(baseReportBody.date),
        zoomAppointments: 10,
        pzmConducted: 8,
        refusalsCount: 0,
        warmingUpCount: 2,
        vzmConducted: 6,
        contractReviewCount: 4,
        pushCount: 3,
        successfulDeals: 2,
        monthlySalesAmount: '1000'
      }
    ])
    prismaMock.report.count.mockResolvedValueOnce(1)

    const req = createRequest('/api/reports', { query: { page: '1', limit: '10' } })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pagination.total).toBe(1)
  })

  it('filters by date range', async () => {
    const startDate = new Date('2024-01-01').toISOString()
    const endDate = new Date('2024-01-31').toISOString()

    const req = createRequest('/api/reports', {
      query: { startDate, endDate }
    })

    await GET(req)

    const call = prismaMock.report.findMany.mock.calls[0][0]
    expect(call.where.date).toMatchObject({
      gte: new Date(startDate),
      lte: new Date(endDate)
    })
  })
})

describe('POST /api/reports', () => {
  it('creates a report for an authorized user', async () => {
    const req = createRequest('/api/reports', {
      method: 'POST',
      body: baseReportBody,
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.report).toMatchObject({
      id: 'report-1',
      userId: 'user-1'
    })
  })

  it('returns 400 for invalid funnel', async () => {
    const req = createRequest('/api/reports', {
      method: 'POST',
      body: { ...baseReportBody, pzmConducted: 20 },
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for future report date', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const req = createRequest('/api/reports', {
      method: 'POST',
      body: { ...baseReportBody, date: futureDate },
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for duplicate report on the same date', async () => {
    prismaMock.report.findUnique.mockResolvedValueOnce({ id: 'existing' })

    const req = createRequest('/api/reports', {
      method: 'POST',
      body: baseReportBody,
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Report for this date already exists')
  })
})
