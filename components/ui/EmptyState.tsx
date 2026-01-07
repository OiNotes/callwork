'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  icon?: React.ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'py-4 px-4' : 'py-10 px-6',
        className
      )}
    >
      <div className={cn('relative', compact ? 'w-14 h-14 mb-3' : 'w-20 h-20 mb-4')}>
        <div className="absolute inset-0 rounded-[24px] bg-[var(--primary)]/10" />
        <div className="absolute inset-3 rounded-[16px] bg-[var(--primary)]/20" />
        <div className="absolute inset-6 rounded-[10px] bg-[var(--primary)]/30" />
        {icon ? (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--primary)]">
            {icon}
          </div>
        ) : null}
      </div>
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] mt-2 max-w-sm">{description}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}
