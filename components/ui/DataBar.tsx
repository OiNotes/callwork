'use client'

import { memo } from 'react'
import { motion } from '@/lib/motion'
import { calcPercent, roundPercent, toDecimal } from '@/lib/utils/decimal'

interface DataBarProps {
  /** Current value */
  value: number
  /** Maximum value (100% reference) */
  max: number
  /** Display label (e.g., formatted money) */
  label?: string
  /** Show percentage badge */
  showPercent?: boolean
  /** Bar color - auto if not specified (uses performance zones) */
  color?: string
  /** Compact mode for tables */
  compact?: boolean
}

/**
 * Inline Data Bar for visual comparison
 *
 * Features:
 * - Proportional bar width
 * - Animated entrance
 * - Optional percentage display
 * - Automatic color coding by performance
 */
function DataBarComponent({
  value,
  max,
  label,
  showPercent = false,
  color,
  compact = false,
}: DataBarProps) {
  const safeMax = max > 0 ? max : 1
  const percent = Math.min(100, roundPercent(calcPercent(toDecimal(value), toDecimal(safeMax))))

  // Auto-determine color based on performance (relative to average)
  const getAutoColor = () => {
    if (percent >= 80) return 'var(--success)'
    if (percent >= 50) return 'var(--warning)'
    return 'var(--muted-foreground)'
  }

  const barColor = color || getAutoColor()

  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-[80px]' : 'min-w-[120px]'}`}>
      {/* Value label */}
      {label && (
        <span
          className={`
            font-medium tabular-nums text-[var(--foreground)] shrink-0
            ${compact ? 'text-xs w-16 text-right' : 'text-sm w-20 text-right'}
          `}
        >
          {label}
        </span>
      )}

      {/* Bar container */}
      <div className={`flex-1 relative ${compact ? 'h-1.5' : 'h-2'} bg-[var(--muted)]/30 rounded-full overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>

      {/* Optional percentage badge */}
      {showPercent && (
        <span
          className={`
            tabular-nums font-medium shrink-0
            ${compact ? 'text-[10px] w-8' : 'text-xs w-10'}
          `}
          style={{ color: barColor }}
        >
          {Math.round(percent)}%
        </span>
      )}
    </div>
  )
}

export const DataBar = memo(DataBarComponent)
