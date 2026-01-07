import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/auth/get-session'
import { SalesForecastService } from '@/lib/services/SalesForecastService'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

const service = new SalesForecastService()

export async function GET() {
  try {
    const manager = await requireManager()
    const data = await service.getDepartmentForecast(manager.id)
    return jsonWithPrivateCache(data)
  } catch (error) {
    logError('Department forecast error', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Manager access required')) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
