import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { getTVData } from '@/lib/tv/getTVData'
import type { Role } from '@prisma/client'
import { logError } from '@/lib/logger'
import { validateOrigin } from '@/lib/csrf'

type AuthUser = { id: string; role: Role }

export async function GET(request: NextRequest) {
  if (!validateOrigin(request)) {
    return new Response('Forbidden', { status: 403 })
  }

  let user: AuthUser
  try {
    user = await requireAuth()
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendData = async () => {
        try {
          const data = await getTVData(user)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (error) {
          logError('Failed to get TV data', error)
        }
      }

      await sendData()

      // Broadcast updates every 30 seconds
      const updateInterval = setInterval(sendData, 30000)

      // Heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(updateInterval)
        clearInterval(heartbeatInterval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
