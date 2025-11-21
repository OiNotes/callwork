import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSettings, type SettingsShape } from './getSettings'

/**
 * Resolve the manager scope for settings:
 * - Manager uses their own ID
 * - Employee uses their manager's ID (if exists) otherwise global defaults
 * - Optional override is respected for manager-facing filters
 */
export async function resolveManagerScope(userId: string, role: Role, overrideManagerId?: string | null) {
  if (overrideManagerId) return overrideManagerId
  if (role === 'MANAGER') return userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  })

  return user?.managerId ?? null
}

export async function getSettingsForUser(
  userId: string,
  role: Role,
  overrideManagerId?: string | null
): Promise<{ settings: SettingsShape; managerScope: string | null }> {
  const managerScope = await resolveManagerScope(userId, role, overrideManagerId)
  const settings = await getSettings(managerScope)
  return { settings, managerScope }
}
