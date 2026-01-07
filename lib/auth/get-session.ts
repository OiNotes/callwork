import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user
  if (!sessionUser?.id) return null

  const user = await prisma.user.findFirst({
    where: { id: sessionUser.id, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      lastLoginAt: true,
    },
  })

  return user ?? null
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireManager() {
  const user = await requireAuth()
  if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
    throw new Error('Forbidden: Manager access required')
  }
  return user
}
