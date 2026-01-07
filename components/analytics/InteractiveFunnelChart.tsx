'use client'

import { memo, useState, useMemo, useCallback } from 'react'
import { motion } from '@/lib/motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingDown, Users, AlertCircle, BarChart2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface FunnelStage {
  stage: string
  count: number
  conversion_rate: number
  is_red_zone: boolean
}

interface InteractiveFunnelChartProps {
  funnel: FunnelStage[]
  onStageClick?: (stage: FunnelStage) => void
}

const isFunnelStage = (value: unknown): value is FunnelStage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stage' in value &&
    'count' in value &&
    'conversion_rate' in value &&
    'is_red_zone' in value
  )
}

// Анимационные варианты
const chartVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }
  }
}

// Кастомный Tooltip
type TooltipPayload = { payload: FunnelStage }

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  const isRedZone = data.is_red_zone

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] rounded-xl p-4 shadow-lg border border-[var(--border)]"
    >
      <p className="text-sm font-semibold text-[var(--foreground)] mb-2">
        {data.stage}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--muted-foreground)]">Количество:</span>
          <span className="text-sm font-medium text-[var(--foreground)]">
            {data.count.toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--muted-foreground)]">Конверсия:</span>
          <span
            className={`text-sm font-medium ${isRedZone ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
          >
            {data.conversion_rate.toFixed(1)}%
          </span>
        </div>
        {isRedZone && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
            <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
            <span className="text-xs text-[var(--danger)] font-medium">
              Красная зона
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export const InteractiveFunnelChart = memo(function InteractiveFunnelChart({
  funnel,
  onStageClick
}: InteractiveFunnelChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Подсчёт статистики
  const stats = useMemo(() => {
    const totalStages = funnel.length
    const redZones = funnel.filter(s => s.is_red_zone).length
    const avgConversion = totalStages > 0
      ? funnel.reduce((sum, s) => sum + s.conversion_rate, 0) / totalStages
      : 0

    return { totalStages, redZones, avgConversion }
  }, [funnel])

  // Цвет бара в зависимости от конверсии
  const getBarColor = (stage: FunnelStage, isHovered: boolean) => {
    if (isHovered) return 'var(--primary)' // Синий при hover
    if (stage.is_red_zone) return 'var(--danger)' // Красный для красной зоны
    if (stage.conversion_rate >= 70) return 'var(--success)' // Зелёный для хорошей конверсии
    return 'var(--primary)' // Синий по умолчанию
  }

  type BarClickData = FunnelStage | { payload?: FunnelStage } | null | undefined

  const handleBarClick = useCallback((data: BarClickData) => {
    if (!onStageClick) return
    if (isFunnelStage(data)) {
      onStageClick(data)
      return
    }
    if (data && typeof data === 'object' && 'payload' in data && isFunnelStage(data.payload)) {
      onStageClick(data.payload)
    }
  }, [onStageClick])

  const handleBarEnter = useCallback((_data: unknown, index: number) => {
    setHoveredIndex(index)
  }, [])

  const handleBarLeave = useCallback(() => {
    setHoveredIndex(null)
  }, [])

  if (!funnel || funnel.length === 0) {
    return (
      <EmptyState
        icon={<BarChart2 className="w-6 h-6" />}
        title="Нет данных воронки"
        description="Данные появятся после первых отчётов."
      />
    )
  }

  return (
    <motion.div
      variants={chartVariants}
      initial="hidden"
      animate="visible"
      className="glass-card rounded-2xl p-8 shadow-lg border border-[var(--border)]"
    >
      {/* Header с статистикой */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">
            Воронка продаж
          </h2>
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <TrendingDown className="w-5 h-5" />
            <span>Нажмите на этап для детализации</span>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--muted)]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                Этапов воронки
              </span>
            </div>
            <p className="text-2xl font-semibold text-[var(--foreground)]">
              {stats.totalStages}
            </p>
          </div>

          <div className="bg-[var(--muted)]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                Красных зон
              </span>
            </div>
            <p className="text-2xl font-semibold text-[var(--danger)]">
              {stats.redZones}
            </p>
          </div>

          <div className="bg-[var(--muted)]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-[var(--success)]" />
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                Средняя конверсия
              </span>
            </div>
            <p className="text-2xl font-semibold text-[var(--success)]">
              {stats.avgConversion.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* График */}
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={funnel}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <defs>
              {/* Градиенты для баров */}
              <linearGradient id="barGradientGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="barGradientRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.8} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />

            <XAxis
              dataKey="stage"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />

            <YAxis
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)' }} />

            <Bar
              dataKey="count"
              radius={[8, 8, 0, 0]}
              onMouseEnter={handleBarEnter}
              onMouseLeave={handleBarLeave}
              onClick={handleBarClick}
              className="cursor-pointer"
            >
              {funnel.map((stage, index) => (
                <Cell
                  key={`cell-${stage.stage}`}
                  fill={getBarColor(stage, hoveredIndex === index)}
                  style={{
                    filter: hoveredIndex === index ? 'brightness(1.1)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Легенда */}
      <div className="mt-6 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--success)]" />
          <span className="text-[var(--muted-foreground)]">Хорошая конверсия (&gt;70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--primary)]" />
          <span className="text-[var(--muted-foreground)]">Норма</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--danger)]" />
          <span className="text-[var(--muted-foreground)]">Красная зона</span>
        </div>
      </div>
    </motion.div>
  )
})
