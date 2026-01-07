import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getDeals } from '@/app/api/deals/route'
import { PATCH as patchDealFocus } from '@/app/api/deals/[id]/focus/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireAuth } from '@/lib/auth/get-session'

vi.mock('@/lib/motivation/scope', () => ({
  resolveAccessibleManagerIds: vi.fn(async () => ['manager-1'])
}))

const csrfHeaders = {
  origin: 'http://localhost',
  host: 'localhost'
}
const dealId = 'c123456789012345678901234'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({
    id: 'manager-1',
    role: 'MANAGER',
    name: 'Manager',
    email: 'manager@example.com'
  })
  prismaMock.deal.findMany.mockResolvedValue([])
  prismaMock.deal.count.mockResolvedValue(0)
})

describe('GET /api/deals', () => {
  it('returns deals for the manager scope', async () => {
    prismaMock.deal.findMany.mockResolvedValueOnce([
      { id: dealId, managerId: 'manager-1', isFocus: false }
    ])
    prismaMock.deal.count.mockResolvedValueOnce(1)

    const req = createRequest('/api/deals', { query: { page: '1', limit: '10' } })
    const res = await getDeals(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
  })
})

describe('PATCH /api/deals/[id]/focus', () => {
  it('toggles deal focus for owner', async () => {
    prismaMock.deal.findUnique.mockResolvedValueOnce({
      id: dealId,
      managerId: 'manager-1',
      manager: { id: 'manager-1' }
    })
    prismaMock.deal.update.mockResolvedValueOnce({ id: dealId, isFocus: true })

    const req = createRequest(`/api/deals/${dealId}/focus`, {
      method: 'PATCH',
      body: { isFocus: true },
      headers: csrfHeaders
    })

    const res = await patchDealFocus(req, { params: Promise.resolve({ id: dealId }) })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isFocus).toBe(true)
  })

  it('blocks focus change for чужую сделку', async () => {
    prismaMock.deal.findUnique.mockResolvedValueOnce({
      id: dealId,
      managerId: 'other-user',
      manager: { id: 'other-user' }
    })
    prismaMock.user.findFirst.mockResolvedValueOnce(null)

    const req = createRequest(`/api/deals/${dealId}/focus`, {
      method: 'PATCH',
      body: { isFocus: true },
      headers: csrfHeaders
    })

    const res = await patchDealFocus(req, { params: Promise.resolve({ id: dealId }) })

    expect(res.status).toBe(403)
  })
})
