import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { resolveAccessibleManagerIds } from '@/lib/motivation/scope'
import type { Role } from '@prisma/client'
import { logError } from '@/lib/logger'
import { validateOrigin } from '@/lib/csrf'
import { escapeHtml } from '@/lib/utils/sanitize'

// Хранилище активных SSE соединений
const clients = new Map<
  ReadableStreamDefaultController,
  { allowedUserIds: Set<string>; userId: string; released: boolean }
>()
const MAX_CONNECTIONS_PER_USER = 5
const userConnectionCounts = new Map<string, number>()

const releaseConnection = (client: { userId: string; released: boolean }) => {
  if (client.released) return
  client.released = true
  const count = userConnectionCounts.get(client.userId) ?? 1
  if (count <= 1) {
    userConnectionCounts.delete(client.userId)
  } else {
    userConnectionCounts.set(client.userId, count - 1)
  }
}

// Функция для отправки события всем подключённым клиентам
export function broadcastDeal(data: {
  employeeId: string
  employeeName: string
  amount: number
  dealsCount: number
}) {
  const safePayload = {
    ...data,
    employeeName: escapeHtml(data.employeeName),
  }
  const message = `data: ${JSON.stringify(safePayload)}\n\n`

  clients.forEach((client, controller) => {
    try {
      if (!client.allowedUserIds.has(data.employeeId)) {
        return
      }
      controller.enqueue(new TextEncoder().encode(message))
    } catch (error) {
      logError('SSE broadcast error', error)
      releaseConnection(client)
      clients.delete(controller)
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return new Response('Forbidden', { status: 403 })
    }

    const user = await requireAuth()
    const allowedUserIds = await resolveAccessibleManagerIds(
      { id: user.id, role: user.role as Role },
      null
    )
    const allowedUserIdSet = new Set(allowedUserIds)
    const userId = user.id
    const currentCount = userConnectionCounts.get(userId) || 0

    if (currentCount >= MAX_CONNECTIONS_PER_USER) {
      return new Response('Too many connections', { status: 429 })
    }

    userConnectionCounts.set(userId, currentCount + 1)

    const stream = new ReadableStream({
      start(controller) {
        // Добавить клиента в список
        const client = { allowedUserIds: allowedUserIdSet, userId, released: false }
        clients.set(controller, client)

        // Отправить initial heartbeat
        controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))

        // Периодический heartbeat (каждые 30 секунд)
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeatInterval)
            releaseConnection(client)
            clients.delete(controller)
          }
        }, 30000)

        // Очистка при закрытии соединения
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval)
          releaseConnection(client)
          clients.delete(controller)
          controller.close()
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
}
