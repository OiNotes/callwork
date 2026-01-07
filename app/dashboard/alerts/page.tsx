'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertCard } from '@/components/alerts/AlertCard'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { logError } from '@/lib/logger'

interface Alert {
  id: string
  type: 'NO_REPORTS' | 'LOW_CONVERSION' | 'NO_DEALS' | 'BEHIND_PACE'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  description: string
  isRead: boolean
  createdAt: string
  user?: {
    id: string
    name: string
  }
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const PAGE_SIZE = 50

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)

  const handleFilterClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const value = event.currentTarget.dataset.filter as 'all' | 'unread' | undefined
    if (!value) return
    setFilter(value)
  }, [])

  const handleSeverityClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const value = event.currentTarget.dataset.severity
    setSeverityFilter(value ? value : null)
  }, [])

  const fetchAlerts = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams()
      if (filter === 'unread') params.set('isRead', 'false')
      if (severityFilter) params.set('severity', severityFilter)
      params.set('page', String(pageToLoad))
      params.set('limit', String(PAGE_SIZE))

      const res = await fetch(`/api/alerts?${params}`)
      const data = await res.json()

      const items = Array.isArray(data.data) ? data.data : []
      setAlerts((prev) => (append ? [...prev, ...items] : items))
      setUnreadCount(data.unreadCount || 0)
      setPagination(data.pagination ?? null)
      setPage(pageToLoad)
    } catch (error) {
      logError('Failed to fetch alerts', error)
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [filter, severityFilter])

  useEffect(() => {
    fetchAlerts(1)
  }, [fetchAlerts])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}/read`, { method: 'PATCH' })
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      logError('Failed to mark alert as read', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/alerts', { method: 'POST' })
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      logError('Failed to mark all as read', error)
    }
  }, [])

  const handleLoadMore = useCallback(() => {
    if (!pagination?.hasNext || loadingMore) return
    fetchAlerts(page + 1, true)
  }, [fetchAlerts, loadingMore, page, pagination?.hasNext])

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Уведомления
          </h1>
          {unreadCount > 0 && (
            <p className="text-[var(--muted-foreground)] mt-2">
              {unreadCount} непрочитанных
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Отметить все прочитанными
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Status filter */}
        <div className="flex gap-2">
          <button
            data-filter="all"
            onClick={handleFilterClick}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === 'all'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            Все
          </button>
          <button
            data-filter="unread"
            onClick={handleFilterClick}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === 'unread'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            Непрочитанные {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Severity filter */}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button
            data-severity=""
            onClick={handleSeverityClick}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              !severityFilter
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            Все уровни
          </button>
          <button
            data-severity="CRITICAL"
            onClick={handleSeverityClick}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              severityFilter === 'CRITICAL'
                ? 'bg-[var(--danger)] text-[var(--status-foreground)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            Критичные
          </button>
          <button
            data-severity="WARNING"
            onClick={handleSeverityClick}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              severityFilter === 'WARNING'
                ? 'bg-[var(--warning)] text-[var(--status-foreground)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            Предупреждения
          </button>
          <button
            data-severity="INFO"
            onClick={handleSeverityClick}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              severityFilter === 'INFO'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
            }`}
          >
            Инфо
          </button>
        </div>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl p-12 text-center border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <BellOff className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Нет уведомлений
          </h3>
          <p className="text-[var(--muted-foreground)]">
            {filter === 'unread' 
              ? 'Все уведомления прочитаны' 
              : 'У вас пока нет уведомлений'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onMarkRead={markAsRead}
            />
          ))}
        </div>
      )}
      {pagination?.hasNext && !loading && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}
      </div>
    </DashboardLayout>
  )
}
