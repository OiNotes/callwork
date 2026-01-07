import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSettingsCached, type SettingsShape } from './getSettings'

const MANAGER_SCOPE_TTL_MS = 60_000
const managerScopeCache = new Map<string, { value: string | null; expiresAt: number }>()

/**
 * Resolve the manager scope for settings:
 * - Manager uses their own ID
 * - Employee uses their manager's ID (if exists) otherwise global defaults
 * - Optional override is respected for manager-facing filters
 */
export async function resolveManagerScope(userId: string, role: Role, overrideManagerId?: string | null) {
  if (overrideManagerId) return overrideManagerId
  if (role === 'MANAGER' || role === 'ADMIN') return userId

  const cached = managerScopeCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { managerId: true },
  })

  const managerId = user?.managerId ?? null
  managerScopeCache.set(userId, { value: managerId, expiresAt: Date.now() + MANAGER_SCOPE_TTL_MS })
  return managerId
}

export async function getSettingsForUser(
  userId: string,
  role: Role,
  overrideManagerId?: string | null
): Promise<{ settings: SettingsShape; managerScope: string | null }> {
  const managerScope = await resolveManagerScope(userId, role, overrideManagerId)
  const settings = await getSettingsCached(managerScope)
  return { settings, managerScope }
}
