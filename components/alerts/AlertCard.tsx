'use client'

import { motion } from '@/lib/motion'
import { useCallback } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

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

interface AlertCardProps {
  alert: Alert
  onMarkRead: (id: string) => void
}

export function AlertCard({ alert, onMarkRead }: AlertCardProps) {
  const handleMarkRead = useCallback(() => {
    onMarkRead(alert.id)
  }, [alert.id, onMarkRead])
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          bg: 'bg-[var(--danger)]/10',
          border: 'border-[var(--danger)]',
          icon: AlertTriangle,
          iconBg: 'bg-[var(--danger)]',
          textColor: 'text-[var(--danger)]'
        }
      case 'WARNING':
        return {
          bg: 'bg-[var(--warning)]/10',
          border: 'border-[var(--warning)]',
          icon: AlertCircle,
          iconBg: 'bg-[var(--warning)]',
          textColor: 'text-[var(--warning)]'
        }
      case 'INFO':
      default:
        return {
          bg: 'bg-[var(--info)]/10',
          border: 'border-[var(--info)]',
          icon: Info,
          iconBg: 'bg-[var(--info)]',
          textColor: 'text-[var(--info)]'
        }
    }
  }

  const config = getSeverityConfig(alert.severity)
  const Icon = config.icon

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} мин назад`
    if (diffHours < 24) return `${diffHours} ч назад`
    return `${diffDays} дн назад`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: alert.isRead ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`p-6 rounded-[var(--radius-lg)] border-2 ${config.border} ${config.bg} ${
        alert.isRead ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6 text-[var(--status-foreground)]" />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className={`text-lg font-semibold ${config.textColor}`}>
                {alert.title}
              </h3>
              {alert.user && (
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  Сотрудник: <strong className="text-[var(--foreground)]">{alert.user.name}</strong>
                </p>
              )}
            </div>

            {!alert.isRead && (
              <button
                onClick={handleMarkRead}
                className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
                aria-label="Пометить как прочитанное"
              >
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            )}
          </div>

          <p className="text-[var(--foreground)] mb-3">{alert.description}</p>

          <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
            <span>{formatDate(alert.createdAt)}</span>
            <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
            <span className="uppercase font-medium">{alert.type.replace('_', ' ')}</span>
            {alert.isRead && (
              <>
                <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
                <span className="text-[var(--muted-foreground)]">Прочитано</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
