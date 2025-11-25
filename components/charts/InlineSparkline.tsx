'use client'

import { memo, useMemo } from 'react'

interface InlineSparklineProps {
  /** Array of values (last 7 days typically) */
  data: number[]
  /** SVG width */
  width?: number
  /** SVG height */
  height?: number
  /** Line color (CSS variable or hex) */
  color?: string
  /** Show dot on last value */
  showDot?: boolean
  /** Fill area under line */
  fill?: boolean
}

/**
 * Minimal SVG Sparkline for inline use in tables
 *
 * Features:
 * - Pure SVG, no external dependencies
 * - Smooth bezier curves
 * - Optional gradient fill
 * - Last value dot indicator
 */
function InlineSparklineComponent({
  data,
  width = 60,
  height = 24,
  color, // No default value, undefined implies auto-color
  showDot = true,
  fill = false, // Default to false (line only)
}: InlineSparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length < 2) return { line: '', area: '', lastPoint: null }

    const padding = 2
    const effectiveWidth = width - padding * 2
    const effectiveHeight = height - padding * 2

    const minVal = Math.min(...data)
    const maxVal = Math.max(...data)
    const range = maxVal - minVal || 1

    // Normalize points to SVG coordinates
    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * effectiveWidth,
      y: padding + effectiveHeight - ((val - minVal) / range) * effectiveHeight,
    }))

    // Build smooth curve using bezier
    let line = `M ${points[0].x},${points[0].y}`

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      // Control point tension
      const tension = 0.3

      let cp1x = prev.x + (curr.x - (points[i - 2]?.x ?? prev.x)) * tension
      let cp1y = prev.y + (curr.y - (points[i - 2]?.y ?? prev.y)) * tension
      let cp2x = curr.x - ((next?.x ?? curr.x) - prev.x) * tension
      let cp2y = curr.y - ((next?.y ?? curr.y) - prev.y) * tension

      // Simpler approach: quadratic bezier through midpoints
      const midX = (prev.x + curr.x) / 2
      const midY = (prev.y + curr.y) / 2

      if (i === 1) {
        line += ` Q ${prev.x},${prev.y} ${midX},${midY}`
      } else {
        line += ` T ${midX},${midY}`
      }
    }

    // End at last point
    const last = points[points.length - 1]
    line += ` L ${last.x},${last.y}`

    // Create area path (for gradient fill)
    const area = `${line} L ${last.x},${height - padding} L ${points[0].x},${height - padding} Z`

    return {
      line,
      area,
      lastPoint: last,
    }
  }, [data, width, height])

  // Determine trend color
  const trendColor = useMemo(() => {
    if (color) return color // Use provided color strictly
    
    if (!data || data.length < 2) return 'var(--muted-foreground)'
    
    const first = data[0]
    const last = data[data.length - 1]
    
    if (last > first) return 'var(--success)'
    if (last < first) return 'var(--danger)'
    return 'var(--muted-foreground)' // Neutral
  }, [data, color])

  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[var(--muted-foreground)]"
        style={{ width, height }}
      >
        <span className="text-[8px]">—</span>
      </div>
    )
  }

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      {fill && pathData.area && (
        <path
          d={pathData.area}
          fill={`url(#${gradientId})`}
        />
      )}

      {/* Line */}
      <path
        d={pathData.line}
        fill="none"
        stroke={trendColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      {showDot && pathData.lastPoint && (
        <circle
          cx={pathData.lastPoint.x}
          cy={pathData.lastPoint.y}
          r={2.5}
          fill={trendColor}
        />
      )}
    </svg>
  )
}

export const InlineSparkline = memo(InlineSparklineComponent)
