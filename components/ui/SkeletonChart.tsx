import { cn } from '@/lib/utils/cn'

interface SkeletonChartProps {
  height?: number
  className?: string
}

export function SkeletonChart({ height = 360, className }: SkeletonChartProps) {
  const bars = [40, 60, 55, 75, 45, 65, 35, 70, 50, 80, 42, 58]

  return (
    <div className={cn('rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-6 animate-pulse', className)}>
      <div className="h-4 w-40 rounded-full bg-[var(--muted)] mb-4" />
      <div className="rounded-[12px] bg-[var(--muted)]/30 p-4" style={{ height }}>
        <div className="flex items-end gap-2 h-full">
          {bars.map((value, index) => (
            <div
              key={index}
              className="flex-1 rounded-md bg-[var(--muted)]"
              style={{ height: `${value}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
