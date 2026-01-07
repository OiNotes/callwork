import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/register/route'
import { createRequest } from './helpers'
import { prismaMock } from '../mocks/prisma'
import { requireManager } from '@/lib/auth/get-session'

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password')
  }
}))

vi.mock('@/lib/services/AuditLogService', () => ({
  AuditLogService: {
    log: vi.fn(async () => undefined)
  }
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true, limit: 5, remaining: 4, reset: 0 })),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response('Too Many Requests', { status: 429 }))
}))

const csrfHeaders = {
  origin: 'http://localhost',
  host: 'localhost'
}

const validBody = {
  email: 'user@example.com',
  password: 'Password123!',
  name: 'Test User'
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
  prismaMock.user.create.mockResolvedValue({
    id: 'user-1',
    email: validBody.email,
    name: validBody.name,
    role: 'EMPLOYEE'
  })
})

describe('POST /api/auth/register', () => {
  it('creates a user with valid data', async () => {
    const req = createRequest('/api/auth/register', {
      method: 'POST',
      body: validBody,
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.user).toMatchObject({
      id: 'user-1',
      email: validBody.email,
      name: validBody.name,
      role: 'EMPLOYEE'
    })
  })

  it('returns 400 for invalid email', async () => {
    const req = createRequest('/api/auth/register', {
      method: 'POST',
      body: { ...validBody, email: 'not-an-email' },
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for short password', async () => {
    const req = createRequest('/api/auth/register', {
      method: 'POST',
      body: { ...validBody, password: 'short' },
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for existing email', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'existing' })

    const req = createRequest('/api/auth/register', {
      method: 'POST',
      body: validBody,
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('User already exists')
  })

  it('returns 401 without authorization', async () => {
    vi.mocked(requireManager).mockRejectedValueOnce(new Error('Unauthorized'))

    const req = createRequest('/api/auth/register', {
      method: 'POST',
      body: validBody,
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-manager', async () => {
    vi.mocked(requireManager).mockRejectedValueOnce(new Error('Forbidden: Manager access required'))

    const req = createRequest('/api/auth/register', {
      method: 'POST',
      body: validBody,
      headers: csrfHeaders
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
