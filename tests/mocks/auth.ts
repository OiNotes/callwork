import { vi } from 'vitest'

export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'MANAGER',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

export const getCurrentUser = vi.fn(() => Promise.resolve(mockSession.user))
export const requireAuth = vi.fn(() => Promise.resolve(mockSession.user))
export const requireManager = vi.fn(() => Promise.resolve(mockSession.user))

vi.mock('@/lib/auth/get-session', () => ({
  getCurrentUser,
  requireAuth,
  requireManager,
}))
