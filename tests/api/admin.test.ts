import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as postAdminUser } from '@/app/api/admin/users/route'
import { POST as postGoalImport } from '@/app/api/admin/goals/import/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireManager } from '@/lib/auth/get-session'

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed')
  }
}))

vi.mock('@/lib/services/AuditLogService', () => ({
  AuditLogService: {
    log: vi.fn(async () => undefined)
  }
}))

vi.mock('@/lib/services/GoalAdminService', () => ({
  GoalAdminService: {
    applyGoalUpdates: vi.fn(async () => ({ updated: 1, failed: 0 }))
  }
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIP: vi.fn(() => '127.0.0.1')
}))

const csrfHeaders = {
  origin: 'http://localhost',
  host: 'localhost'
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireManager).mockResolvedValue({
    id: 'manager-1',
    role: 'MANAGER',
    name: 'Manager',
    email: 'manager@example.com'
  })
  prismaMock.user.findUnique.mockResolvedValue(null)
})

describe('POST /api/admin/users', () => {
  it('allows admin to create a user', async () => {
    vi.mocked(requireManager).mockResolvedValueOnce({
      id: 'admin-1',
      role: 'ADMIN',
      name: 'Admin',
      email: 'admin@example.com'
    })
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-1',
      name: 'New User',
      email: 'user@example.com',
      role: 'EMPLOYEE',
      isActive: true,
      managerId: 'admin-1',
      createdAt: new Date(),
      lastLoginAt: null
    })

    const req = createRequest('/api/admin/users', {
      method: 'POST',
      headers: csrfHeaders,
      body: {
        name: 'New User',
        email: 'user@example.com',
        role: 'EMPLOYEE',
        password: 'Password123!'
      }
    })

    const res = await postAdminUser(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.user).toMatchObject({ email: 'user@example.com', role: 'EMPLOYEE' })
  })

  it('blocks manager from creating manager', async () => {
    const req = createRequest('/api/admin/users', {
      method: 'POST',
      headers: csrfHeaders,
      body: {
        name: 'Manager Two',
        email: 'manager2@example.com',
        role: 'MANAGER',
        password: 'Password123!'
      }
    })

    const res = await postAdminUser(req)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/goals/import', () => {
  it('imports CSV goals', async () => {
    const csv = 'email,monthlyGoal\nuser@example.com,1000\n'
    const file = new File([csv], 'goals.csv', { type: 'text/csv' }) as File & {
      text?: () => Promise<string>
    }
    file.text = async () => csv
    const formData = new FormData()
    formData.append('file', file)

    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: 'user-1', email: 'user@example.com' }
    ])

    const req = {
      headers: new Headers(csrfHeaders),
      formData: async () => formData
    } as Request

    const res = await postGoalImport(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.processed).toBe(1)
  })

  it('returns 413 when file exceeds 5MB', async () => {
    const bigContent = new Uint8Array(5 * 1024 * 1024 + 1)
    const file = new File([bigContent], 'big.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', file)

    const req = {
      headers: new Headers(csrfHeaders),
      formData: async () => formData
    } as Request

    const res = await postGoalImport(req)
    expect(res.status).toBe(413)
  })
})
