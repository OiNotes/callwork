import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

// Ensure React Testing Library runs in act() environment.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: '1', role: 'MANAGER' } },
    status: 'authenticated',
  }),
  SessionProvider: ({ children }: { children: ReactNode }) => children,
}))

// Global mocks for prisma/auth helpers.
import './mocks/prisma'
import './mocks/auth'
