import { memo } from 'react'

interface MetricBadgeProps {
  label: string
  value: string
  isGood: boolean
}

export const MetricBadge = memo(function MetricBadge({ label, value, isGood }: MetricBadgeProps) {
  return (
    <div className={`p-2 rounded-[var(--radius-md)] ${isGood ? 'bg-[var(--success)]/10' : 'bg-[var(--danger)]/10'}`}>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={`text-lg font-semibold ${isGood ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
        {value}
      </p>
    </div>
  )
})
