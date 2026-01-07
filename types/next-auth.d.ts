import type { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      sessionId?: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: Role
    sessionId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    sessionId?: string
  }
}
