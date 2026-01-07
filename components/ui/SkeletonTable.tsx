import { cn } from '@/lib/utils/cn'

interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ rows = 6, columns = 4, className }: SkeletonTableProps) {
  const cols = Array.from({ length: columns })

  return (
    <div
      className={cn('rounded-[16px] border border-[var(--border)] bg-[var(--card)] overflow-hidden animate-pulse', className)}
    >
      <div
        className="grid gap-4 px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cols.map((_, index) => (
          <div key={index} className="h-3 rounded-full bg-[var(--muted)]" />
        ))}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {cols.map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-3 rounded-full bg-[var(--muted)]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
