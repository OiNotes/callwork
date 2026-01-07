import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getEmployees } from '@/app/api/employees/route'
import { GET as getEmployeeStats } from '@/app/api/employees/[id]/stats/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireManager, getCurrentUser } from '@/lib/auth/get-session'

const baseStats = {
  zoomBooked: 10,
  zoom1Held: 8,
  zoom2Held: 6,
  contractReview: 4,
  pushCount: 3,
  successfulDeals: 2,
  salesAmount: 1000,
  refusals: 1,
  warming: 1,
  planSales: 2000,
  planDeals: 5,
  bookedToZoom1: 80,
  zoom1ToZoom2: 75,
  zoom2ToContract: 70,
  contractToPush: 60,
  pushToDeal: 50,
  northStar: 5,
  activityScore: 90,
  trend: 'up'
}
const employeeId = 'c123456789012345678901234'

vi.mock('@/lib/analytics/conversions', () => ({
  calculateConversions: vi.fn(() => ({
    bookedToZoom1: 100,
    zoom1ToZoom2: 100,
    zoom2ToContract: 100,
    contractToPush: 100,
    pushToDeal: 100,
    northStar: 100
  })),
  getDateRange: vi.fn(() => ({
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  }))
}))

vi.mock('@/lib/analytics/funnel', () => ({
  calculateManagerStats: vi.fn(async () => baseStats)
}))

vi.mock('@/lib/calculations/funnel', () => ({
  calculateFullFunnel: vi.fn(() => ({
    funnel: [],
    sideFlow: [],
    northStarKpi: null
  }))
}))

vi.mock('@/lib/settings/context', () => ({
  getSettingsForUser: vi.fn(async () => ({
    settings: {
      salesPerDeal: 1000,
      conversionBenchmarks: {
        BOOKED_TO_ZOOM1: 60,
        ZOOM1_TO_ZOOM2: 50,
        ZOOM2_TO_CONTRACT: 40,
        CONTRACT_TO_PUSH: 60,
        PUSH_TO_DEAL: 70
      },
      northStarTarget: 5
    },
    managerScope: null
  }))
}))

vi.mock('@/lib/services/GoalService', () => ({
  GoalService: {
    getUsersGoals: vi.fn(async () => ({}))
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireManager).mockResolvedValue({
    id: 'manager-1',
    role: 'MANAGER',
    name: 'Manager',
    email: 'manager@example.com'
  })
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: 'manager-1',
    role: 'MANAGER',
    name: 'Manager',
    email: 'manager@example.com'
  })
  prismaMock.user.findMany.mockResolvedValue([])
  prismaMock.user.count.mockResolvedValue(0)
  prismaMock.report.findMany.mockResolvedValue([])
})

describe('GET /api/employees', () => {
  it('returns team members for manager', async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([
        {
          id: 'employee-1',
          name: 'Employee',
          email: 'emp@example.com',
          role: 'EMPLOYEE',
          reports: []
        }
      ])
      .mockResolvedValueOnce([{ id: 'employee-1' }])
    prismaMock.user.count.mockResolvedValueOnce(1)

    const req = createRequest('/api/employees')
    const res = await getEmployees(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.pagination.total).toBe(1)
  })

  it('returns 403 for non-manager', async () => {
    vi.mocked(requireManager).mockRejectedValueOnce(new Error('Forbidden: Manager access required'))

    const req = createRequest('/api/employees')
    const res = await getEmployees(req)

    expect(res.status).toBe(403)
  })
})

describe('GET /api/employees/[id]/stats', () => {
  it('allows manager to view team member stats', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ managerId: 'manager-1' })
      .mockResolvedValueOnce({ id: employeeId, name: 'Employee', role: 'EMPLOYEE', managerId: 'manager-1' })
    prismaMock.user.findMany.mockResolvedValue([])

    const req = createRequest(`/api/employees/${employeeId}/stats`)
    const res = await getEmployeeStats(req, { params: Promise.resolve({ id: employeeId }) })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.employee).toMatchObject({ id: employeeId, name: 'Employee' })
  })

  it('rejects manager access to чужого сотрудника', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ managerId: 'other-manager' })

    const req = createRequest(`/api/employees/${employeeId}/stats`)
    const res = await getEmployeeStats(req, { params: Promise.resolve({ id: employeeId }) })

    expect(res.status).toBe(403)
  })

  it('rejects employee access to other users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: 'employee-1',
      role: 'EMPLOYEE',
      name: 'Employee',
      email: 'emp@example.com'
    })

    const req = createRequest(`/api/employees/${employeeId}/stats`)
    const res = await getEmployeeStats(req, { params: Promise.resolve({ id: employeeId }) })

    expect(res.status).toBe(403)
  })
})
