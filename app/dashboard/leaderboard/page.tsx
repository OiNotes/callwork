'use client'

import { useState, useEffect, useCallback } from 'react'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { VirtualGong } from '@/components/leaderboard/VirtualGong'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { logError } from '@/lib/logger'

interface LeaderboardItem {
  id: string
  name: string
  deals: number
  sales: number
  avgCheck: number
  goalProgress: number | null
  finalConversion: number
  rank: number
  medal?: 'gold' | 'silver' | 'bronze'
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?period=${period}&page=${page}&limit=50`)
      const data = await res.json()
      setLeaderboard(data.data ?? [])
      setPagination(data.pagination ?? null)
    } catch (error) {
      logError('Failed to fetch leaderboard', error)
    } finally {
      setLoading(false)
    }
  }, [period, page])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  useEffect(() => {
    setPage(1)
  }, [period])

  return (
    <DashboardLayout>
      <VirtualGong />
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Лидерборд команды</h1>

        <LeaderboardTable
          leaderboard={leaderboard}
          period={period}
          onPeriodChange={setPeriod}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
        />
      </div>
    </DashboardLayout>
  )
}
