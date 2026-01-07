import { cn } from '@/lib/utils/cn'

interface SkeletonCardProps {
  lines?: number
  className?: string
}

export function SkeletonCard({ lines = 4, className }: SkeletonCardProps) {
  const widths = ['w-5/6', 'w-4/6', 'w-3/6', 'w-2/6', 'w-4/6']

  return (
    <div className={cn('rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-6 animate-pulse', className)}>
      <div className="h-4 w-32 rounded-full bg-[var(--muted)] mb-4" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn('h-3 rounded-full bg-[var(--muted)]', widths[index % widths.length])}
          />
        ))}
      </div>
    </div>
  )
}
