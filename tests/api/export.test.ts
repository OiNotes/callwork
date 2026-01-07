import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as exportReports } from '@/app/api/export/reports/route'
import { GET as exportLeaderboard } from '@/app/api/export/leaderboard/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireAuth, requireManager } from '@/lib/auth/get-session'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({
    id: 'user-1',
    role: 'EMPLOYEE',
    name: 'User',
    email: 'user@example.com'
  })
  vi.mocked(requireManager).mockResolvedValue({
    id: 'manager-1',
    role: 'MANAGER',
    name: 'Manager',
    email: 'manager@example.com'
  })
})

describe('GET /api/export/reports', () => {
  it('exports CSV and sanitizes formula injection', async () => {
    prismaMock.report.findMany.mockResolvedValueOnce([
      {
        date: new Date('2024-01-02T00:00:00.000Z'),
        user: { name: '=SUM(A1)', email: 'user@example.com' },
        zoomAppointments: 1,
        pzmConducted: 1,
        vzmConducted: 1,
        contractReviewCount: 1,
        pushCount: 1,
        successfulDeals: 1,
        monthlySalesAmount: '1000',
        refusalsCount: 0,
        warmingUpCount: 0,
        comment: '@alert'
      }
    ])

    const startDate = new Date('2024-01-01').toISOString()
    const endDate = new Date('2024-01-05').toISOString()

    const req = createRequest('/api/export/reports', {
      query: { format: 'csv', startDate, endDate }
    })

    const res = await exportReports(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const csv = await res.text()
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain("'@alert")
  })

  it('exports XLSX', async () => {
    prismaMock.report.findMany.mockResolvedValueOnce([
      {
        date: new Date('2024-01-02T00:00:00.000Z'),
        user: { name: 'User', email: 'user@example.com' },
        zoomAppointments: 1,
        pzmConducted: 1,
        vzmConducted: 1,
        contractReviewCount: 1,
        pushCount: 1,
        successfulDeals: 1,
        monthlySalesAmount: '1000',
        refusalsCount: 0,
        warmingUpCount: 0,
        comment: ''
      }
    ])

    const startDate = new Date('2024-01-01').toISOString()
    const endDate = new Date('2024-01-05').toISOString()

    const req = createRequest('/api/export/reports', {
      query: { format: 'xlsx', startDate, endDate }
    })

    const res = await exportReports(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('returns 400 for period > 90 days', async () => {
    const startDate = new Date('2024-01-01').toISOString()
    const endDate = new Date('2024-05-01').toISOString()

    const req = createRequest('/api/export/reports', {
      query: { format: 'csv', startDate, endDate }
    })

    const res = await exportReports(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/export/leaderboard', () => {
  it('exports CSV leaderboard with sanitized fields', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: 'user-1',
        name: '=USER()',
        email: 'user@example.com',
        role: 'EMPLOYEE',
        reports: [
          {
            monthlySalesAmount: '1000',
            successfulDeals: 1,
            zoomAppointments: 2,
            pzmConducted: 1,
            vzmConducted: 1
          }
        ]
      }
    ])

    const req = createRequest('/api/export/leaderboard', {
      query: { format: 'csv', period: 'month' }
    })

    const res = await exportLeaderboard(req)
    expect(res.status).toBe(200)
    const csv = await res.text()
    expect(csv).toContain("'=USER()")
  })
})
