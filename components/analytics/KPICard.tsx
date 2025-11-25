'use client'

import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { InlineSparkline } from '@/components/charts/InlineSparkline'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode // Deprecated visually, but kept for type compatibility
  subtitle?: string
  history?: number[]
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  }
}

export const KPICard = memo(function KPICard({
  title,
  value,
  change,
  subtitle,
  history
}: KPICardProps) {
  const isPositive = useMemo(
    () => change !== undefined && change >= 0,
    [change]
  )

  // Clean trend color
  const trendColor = isPositive ? 'var(--success)' : 'var(--danger)'
  
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="group relative flex flex-col h-full"
    >
      <div className="glass-card p-5 border border-[var(--border)] bg-[var(--card)] rounded-xl shadow-sm flex flex-col h-full hover:shadow-md transition-shadow duration-300">
        
        {/* Top Row: Title & Change Badge */}
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider truncate pr-2">
            {title}
          </h3>
          
          {change !== undefined && (
            <div className={`
              flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums
              ${isPositive 
                ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' 
                : 'text-rose-700 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400'
              }
            `}>
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>

        {/* Middle Row: Main Value */}
        <div className="mb-4">
          <div className="text-2xl font-black text-[var(--foreground)] tracking-tight tabular-nums leading-none">
            {value}
          </div>
          {subtitle && (
             <div className="text-[11px] text-[var(--muted-foreground)] mt-1.5 font-medium">
                {subtitle}
             </div>
          )}
        </div>

        {/* Bottom Row: Sparkline (replaces icon) */}
        {history && history.length > 1 && (
          <div className="mt-auto pt-2">
             <div className="h-8 w-full opacity-80 group-hover:opacity-100 transition-opacity">
                <InlineSparkline 
                  data={history} 
                  width={140} 
                  height={32} 
                  color={isPositive ? 'var(--success)' : 'var(--danger)'}
                  fill={true}
                  showDot={true}
                />
             </div>
          </div>
        )}
      </div>
    </motion.div>
  )
})