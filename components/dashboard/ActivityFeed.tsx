'use client'

import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from '@/lib/motion'
import { Activity, TrendingUp, FileText, AlertTriangle } from 'lucide-react'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { logError } from '@/lib/logger'

interface ActivityItem {
  id: string
  type: 'deal' | 'report' | 'alert'
  message: string
  details?: string
  timestamp: string
  userId: string
  userName: string
}

const PAGE_SIZE = 20

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'deal':
      return TrendingUp
    case 'alert':
      return AlertTriangle
    case 'report':
    default:
      return FileText
  }
}

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'deal':
      return 'text-[var(--success)] bg-[var(--success)]/10'
    case 'alert':
      return 'text-[var(--danger)] bg-[var(--danger)]/10'
    case 'report':
    default:
      return 'text-[var(--primary)] bg-[var(--primary)]/10'
  }
}

const formatTimeAgo = (timestamp: string) => {
  const now = new Date()
  const past = new Date(timestamp)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return past.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function ActivityFeedComponent() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef(page)

  useEffect(() => {
    pageRef.current = page
  }, [page])

  const fetchActivities = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch(`/api/activities/recent?page=${pageToLoad}&limit=${PAGE_SIZE}`)
      if (!res.ok) {
        throw new Error('Не удалось загрузить активности')
      }
      const data = await res.json()
      const items = Array.isArray(data.data) ? data.data : []
      const pagination = data.pagination

      setActivities((prev) => (append ? [...prev, ...items] : items))
      setHasNext(Boolean(pagination?.hasNext))
      setPage(pageToLoad)
      setError(null)
    } catch (error) {
      logError('Failed to fetch activities', error)
      setError(error instanceof Error ? error.message : 'Не удалось загрузить активности')
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchActivities(1)

    const eventSource = new EventSource('/api/sse/activities')

    eventSource.onmessage = (event) => {
      try {
        const newActivity = JSON.parse(event.data)
        setActivities((prev) => {
          if (prev.some((activity) => activity.id === newActivity.id)) return prev
          const next = [newActivity, ...prev]
          const maxItems = PAGE_SIZE * pageRef.current
          return next.slice(0, maxItems)
        })
      } catch (error) {
        logError('Failed to parse SSE activity', error)
      }
    }

    eventSource.onerror = (error) => {
      logError('SSE error', error)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [fetchActivities])

  const handleRetry = useCallback(() => {
    fetchActivities(1)
  }, [fetchActivities])

  const handleLoadMore = useCallback(() => {
    if (!hasNext || loadingMore) return
    fetchActivities(page + 1, true)
  }, [fetchActivities, hasNext, loadingMore, page])

  const activityRows = useMemo(
    () =>
      activities.map((activity) => ({
        ...activity,
        Icon: getActivityIcon(activity.type),
        colorClass: getActivityColor(activity.type),
        timeAgo: formatTimeAgo(activity.timestamp),
      })),
    [activities]
  )

  if (loading) {
    return (
      <SkeletonCard className="h-[600px]" lines={8} />
    )
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-red-500 mb-4">Не удалось загрузить активности</p>
        <button onClick={handleRetry} className="btn-primary">
          Повторить
        </button>
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div className="glass-card p-6 h-[600px]">
        <EmptyState
          icon={<Activity className="w-6 h-6" />}
          title="Нет активностей"
          description="Активности появятся после создания отчётов"
          className="h-full justify-center"
        />
      </div>
    )
  }

  return (
    <div className="glass-card p-6 h-[600px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-[var(--muted-foreground)]" />
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Activity</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {activityRows.map((activity, index) => {
            const Icon = activity.Icon
            const colorClass = activity.colorClass
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-[var(--secondary)] transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{activity.message}</p>
                  {activity.details && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{activity.details}</p>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 opacity-70">
                    {activity.timeAgo}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {hasNext && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mt-4 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50"
        >
          {loadingMore ? 'Загрузка...' : 'Показать ещё'}
        </button>
      )}
    </div>
  )
}

export const ActivityFeed = memo(ActivityFeedComponent)
