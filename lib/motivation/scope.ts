import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export interface SessionUser {
  id: string
  role: Role | 'MANAGER' | 'EMPLOYEE'
}

export async function resolveAccessibleManagerIds(
  user: SessionUser,
  requestedId: string | null
): Promise<string[]> {
  if (user.role !== 'MANAGER') {
    return [user.id]
  }

  // Получаем команду менеджера (он сам + его сотрудники)
  const team = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { managerId: user.id },
        { id: user.id },
      ],
    },
    select: { id: true },
  })

  const teamIds = team.length > 0 ? team.map((member) => member.id) : [user.id]

  // 'all' = вся команда менеджера (НЕ все пользователи системы!)
  if (requestedId === 'all' || !requestedId) {
    return teamIds
  }

  // Конкретный ID: проверяем что пользователь входит в команду менеджера
  if (teamIds.includes(requestedId)) {
    return [requestedId]
  }

  // Запрошен пользователь вне команды - возвращаем только самого менеджера
  // (безопасный fallback вместо утечки данных)
  return [user.id]
}
