'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from '@/lib/motion'
import { logError } from '@/lib/logger'

export function AlertBadge() {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?isRead=false')
      const data = await res.json()
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      logError('Failed to fetch unread count', error)
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    
    // Обновлять каждые 60 секунд
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  if (unreadCount === 0) return null

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--danger)] rounded-full flex items-center justify-center"
    >
      <span className="text-xs font-bold text-[var(--status-foreground)]">{unreadCount}</span>
    </motion.div>
  )
}
