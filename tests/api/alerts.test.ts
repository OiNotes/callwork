import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getAlerts } from '@/app/api/alerts/route'
import { PATCH as patchAlertRead } from '@/app/api/alerts/[id]/read/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireAuth } from '@/lib/auth/get-session'

const csrfHeaders = {
  origin: 'http://localhost',
  host: 'localhost'
}
const alertId = 'c123456789012345678901234'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({
    id: 'user-1',
    role: 'EMPLOYEE',
    name: 'Employee',
    email: 'emp@example.com'
  })
})

describe('GET /api/alerts', () => {
  it('returns user alerts with unread count', async () => {
    prismaMock.$transaction.mockResolvedValueOnce([
      [{ id: 'alert-1', isRead: false, userId: 'user-1' }],
      1,
      1
    ])

    const req = createRequest('/api/alerts', { query: { isRead: 'false' } })
    const res = await getAlerts(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.unreadCount).toBe(1)
  })
})

describe('PATCH /api/alerts/[id]/read', () => {
  it('marks alert as read', async () => {
    prismaMock.alert.findUnique.mockResolvedValueOnce({
      id: alertId,
      userId: 'user-1'
    })
    prismaMock.alert.update.mockResolvedValueOnce({ id: alertId, isRead: true })

    const req = createRequest(`/api/alerts/${alertId}/read`, {
      method: 'PATCH',
      headers: csrfHeaders
    })

    const res = await patchAlertRead(req, { params: Promise.resolve({ id: alertId }) })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.alert).toMatchObject({ id: alertId, isRead: true })
  })
})
