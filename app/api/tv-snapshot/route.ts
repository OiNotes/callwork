/**
 * TV Snapshot API - одноразовая выгрузка данных для TV Dashboard
 *
 * Возвращает JSON response для инициализации клиента.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { getTVData } from '@/lib/tv/getTVData'
import { logError } from '@/lib/logger'
import { jsonWithPrivateCache } from '@/lib/utils/http'

export async function GET() {
  try {
    const user = await requireAuth()
    const data = await getTVData(user)
    return jsonWithPrivateCache(data)
  } catch (error) {
    logError('Failed to get TV snapshot', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
