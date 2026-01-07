import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/leaderboard/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireAuth } from '@/lib/auth/get-session'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({
    id: 'manager-1',
    role: 'MANAGER',
    name: 'Manager',
    email: 'manager@example.com'
  })
})

describe('GET /api/leaderboard', () => {
  it('returns leaderboard for period', async () => {
    prismaMock.user.count.mockResolvedValueOnce(1)
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          name: 'Employee',
          sales: 1000,
          deals: 2,
          zoom: 5,
          pzm: 4,
          vzm: 3,
          goal: 2000
        }
      ])
      .mockResolvedValueOnce([{ totalSales: 1000, totalDeals: 2 }])

    const req = createRequest('/api/leaderboard', { query: { period: 'week', page: '1', limit: '10' } })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.stats.totalEmployees).toBe(1)
    expect(json.data[0].rank).toBe(1)
  })

  it('returns 400 for invalid period', async () => {
    const req = createRequest('/api/leaderboard', { query: { period: 'year' } })
    const res = await GET(req)

    expect(res.status).toBe(400)
  })
})
