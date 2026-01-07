'use client'

import { motion } from '@/lib/motion'
import { AlertTriangle, Users, TrendingDown, Flame, XCircle, Activity, ChevronDown } from 'lucide-react'
import { getConversionColor, formatNumber, formatPercent } from '@/lib/calculations/funnel'
import type { FunnelStage, SideFlow } from '@/lib/calculations/funnel'
import { memo, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'

function getDropoff(current: number, next: number): number {
  if (current === 0) return 0
  return Math.round((1 - next / current) * 100)
}

function getStageColor(conversion: number, benchmark: number): string {
  const ratio = conversion / benchmark
  if (ratio >= 1) return 'text-emerald-500'
  if (ratio >= 0.8) return 'text-amber-500'
  return 'text-red-500'
}

interface FullFunnelChartProps {
  funnel: FunnelStage[]
  sideFlow: SideFlow
  onStageClick?: (stage: FunnelStage) => void
}

export const FullFunnelChart = memo(function FullFunnelChart({ funnel, sideFlow, onStageClick }: FullFunnelChartProps) {
  const maxValue = useMemo(() => Math.max(...funnel.map((stage) => stage.value), 1), [funnel])
  const stagesWithDropoff = useMemo(
    () =>
      funnel.map((stage, index) => {
        const nextStage = funnel[index + 1]
        return {
          ...stage,
          dropoff: nextStage ? getDropoff(stage.value, nextStage.value) : 0,
          widthPercent: Math.max(40, (stage.value / maxValue) * 100),
          nextWidthPercent: nextStage ? Math.max(40, (nextStage.value / maxValue) * 100) : 40,
        }
      }),
    [funnel, maxValue]
  )
  const stageById = useMemo(
    () => new Map<string, FunnelStage>(funnel.map((stage) => [stage.id, stage])),
    [funnel]
  )

  const handleStageClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onStageClick) return
    const stageId = event.currentTarget.dataset.stageId
    if (!stageId) return
    const stage = stageById.get(stageId)
    if (stage) {
      onStageClick(stage)
    }
  }, [onStageClick, stageById])
  const handleStageKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.currentTarget.click()
    }
  }, [])

  if (!funnel || funnel.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-[var(--muted-foreground)] bg-[var(--muted)]/50 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
        <Activity className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">Нет данных для воронки</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 p-2">
      {/* Main Funnel Visualization */}
      <div className="relative">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary)]/[0.02] via-transparent to-[var(--danger)]/[0.02] -z-10 rounded-[var(--radius-lg)] pointer-events-none" />

        {/* Funnel Container */}
        <div className="relative flex flex-col items-center py-4">
          {stagesWithDropoff.map((stage, index) => {
            const widthPercent = stage.widthPercent
            const nextWidthPercent = stage.nextWidthPercent
            const color = getConversionColor(stage.conversion, stage.isRedZone)
            const isLast = index === stagesWithDropoff.length - 1
            const dropoff = stage.dropoff ?? 0
            const conversionClass = getStageColor(stage.conversion, stage.benchmark)

            return (
              <motion.div
                key={stage.id || stage.stage}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.08,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="w-full flex flex-col items-center group"
              >
                {/* Stage Card */}
                <motion.div
                  className={cn(
                    "relative overflow-hidden cursor-pointer transition-all duration-300",
                    "rounded-[var(--radius-lg)] border",
                    stage.isRedZone
                      ? "border-[var(--danger)]/30 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
                      : "border-[var(--border)] shadow-[var(--shadow-sm)]",
                    "hover:shadow-[var(--shadow-lg)] hover:scale-[1.02]",
                    "bg-[var(--card)]"
                  )}
                  style={{ width: `${widthPercent}%`, minWidth: '300px' }}
                  data-stage-id={stage.id}
                  onClick={handleStageClick}
                  onKeyDown={handleStageKeyDown}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${stage.stage}: ${formatNumber(stage.value)} (${formatPercent(stage.conversion)})`}
                >
                  {/* Gradient overlay based on conversion status */}
                  <div
                    className="absolute inset-0 opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.12]"
                    style={{
                      background: `linear-gradient(135deg, ${color} 0%, transparent 60%)`
                    }}
                  />

                  {/* Content */}
                  <div className="relative flex items-center justify-between px-6 py-5">
                    {/* Left: Stage number, label & count */}
                    <div className="flex items-center gap-4">
                      <div
                        className="flex items-center justify-center w-11 h-11 rounded-full text-[var(--status-foreground)] font-bold text-lg shadow-lg transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 4px 14px ${color}40`
                        }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-[var(--foreground)] text-lg leading-tight">
                          {stage.stage}
                        </h3>
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)] mt-1">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-sm font-semibold tabular-nums">{formatNumber(stage.value)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Conversion percentage & status */}
                    <div className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn('text-3xl font-black tracking-tight tabular-nums', conversionClass)}>
                          {formatPercent(stage.conversion)}
                        </span>
                        <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mt-0.5">
                          Конверсия
                        </span>
                      </div>

                      {stage.isRedZone && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] text-xs font-bold"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Внимание</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Connector with dropoff indicator */}
                {!isLast && (
                  <div className="relative flex flex-col items-center py-1">
                    {/* Narrowing connector shape */}
                    <div
                      className="relative h-8 transition-all duration-300"
                      style={{
                        width: `${widthPercent}%`,
                        minWidth: '300px',
                        clipPath: `polygon(${(100 - nextWidthPercent/widthPercent * 100) / 2}% 100%, ${100 - (100 - nextWidthPercent/widthPercent * 100) / 2}% 100%, 100% 0%, 0% 0%)`
                      }}
                    >
                      <div
                        className="absolute inset-0 bg-gradient-to-b from-[var(--border)] to-[var(--border)]/50"
                        style={{ opacity: 0.3 }}
                      />
                    </div>

                    {/* Dropoff badge */}
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 + 0.3 }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 lg:translate-x-8"
                    >
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap",
                        "bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                        <span>-{formatPercent(dropoff)} отвал</span>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Side Panel */}
      <div className="space-y-6">
        {/* Refusals Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card rounded-[var(--radius-lg)] p-6 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-3 opacity-[0.03]">
            <XCircle className="w-28 h-28" />
          </div>

          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-[var(--danger)]/10 text-[var(--danger)]">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-lg">Отказы</h3>
                <p className="text-xs text-[var(--muted-foreground)] font-medium">Аналитика потерь</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                <div className="text-2xl font-black text-[var(--foreground)] tabular-nums">
                  {formatNumber(sideFlow.refusals.total)}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] font-medium mt-1">Всего отказов</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20">
                <div className="text-2xl font-black text-[var(--danger)] tabular-nums">
                  {formatPercent(sideFlow.refusals.rateFromFirstZoom)}
                </div>
                <div className="text-xs text-[var(--danger)]/70 font-medium mt-1">От 1-го Zoom</div>
              </div>
            </div>

            <div className="space-y-2">
              {sideFlow.refusals.byStage.map((item, i) => (
                <motion.div
                  key={item.stageId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--muted)] transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[var(--foreground)] tabular-nums">{formatNumber(item.count)}</span>
                    <div className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full tabular-nums",
                      item.rate > 20
                        ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                        : "bg-[var(--success)]/10 text-[var(--success)]"
                    )}>
                      {formatPercent(item.rate)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Warming Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-[var(--radius-lg)] p-6 border border-[var(--warning)]/20 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--warning) 8%, var(--card)) 0%, var(--card) 100%)'
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[var(--warning)]/15 text-[var(--warning)]">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-lg">В подогреве</h3>
                <p className="text-xs text-[var(--muted-foreground)] font-medium">Потенциальные сделки</p>
              </div>
            </div>
            <div className="text-4xl font-black text-[var(--warning)] tabular-nums">
              {formatNumber(sideFlow.warming.count)}
            </div>
          </div>

          {/* Visual indicator bars */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(sideFlow.warming.count, 20) }).map((_, i) => (
              <motion.div
                key={`warming-${sideFlow.warming.count}-${i}`}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.5 + i * 0.02
                }}
                className="w-2 h-8 rounded-full origin-bottom"
                style={{
                  background: `linear-gradient(to top, var(--warning) 0%, color-mix(in srgb, var(--warning) 40%, transparent) 100%)`
                }}
              />
            ))}
            {sideFlow.warming.count > 20 && (
              <div className="flex items-center justify-center h-8 px-3 text-xs font-bold text-[var(--warning)] bg-[var(--warning)]/15 rounded-lg">
                +{sideFlow.warming.count - 20}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
})
