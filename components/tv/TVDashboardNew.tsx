'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TrendingUp, Target, ArrowUpRight, AlertTriangle, type LucideIcon } from 'lucide-react'
import { Toaster } from 'sonner'
import { calcPercent, roundPercent, toDecimal } from '@/lib/utils/decimal'
import { logError } from '@/lib/logger'
import { useAnimatedValue } from '@/hooks/useAnimatedValue'

interface TVFunnelStage {
  id: string
  label: string
  conversion: number
  benchmark: number
  isRedZone: boolean
}

interface TVData {
  period: {
    start: string
    end: string
  }
  summary: {
    sales: number
    deals: number
    plan: number
    progress: number
  }
  leaderboard: Array<{
    id: string
    rank: number
    name: string
    sales: number
    deals: number
    goal: number
    progress: number
  }>
  funnel: TVFunnelStage[]
  recentDeals: Array<{
    id: string
    userId: string
    userName: string
    amount: number
    deals: number
    createdAt: string
  }>
  redZones: Array<{
    id: string
    name: string
    stage: string
    conversion: number
    benchmark: number
  }>
}

interface LeaderRowProps {
  emp: {
    id: string
    name: string
    amount: number
    avatar: string
  }
  index: number
  max: number
}

interface StatBadge {
  text: string
  tone?: 'success' | 'warning' | 'danger'
}

interface StatCardProps {
  label: string
  value: number
  suffix?: string
  icon: LucideIcon
  badge?: StatBadge
  highlight?: boolean
}

const formatCompact = (num: number) => {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(num)
}

const formatStandard = (num: number) => {
  return new Intl.NumberFormat('ru-RU').format(num)
}

const formatPercent = (num: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(num)}%`

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const formatTimeAgo = (timestamp: string) => {
  const now = new Date()
  const past = new Date(timestamp)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин назад`
  if (diffHours < 24) return `${diffHours} ч назад`
  return past.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const LoadingScreen = () => (
  <div className="h-screen w-screen bg-[var(--background)] flex items-center justify-center transition-colors">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--primary)] border-t-transparent mb-6 mx-auto" />
      <p className="text-[var(--muted-foreground)] text-2xl font-semibold">Загрузка TV Dashboard...</p>
    </div>
  </div>
)

const LeaderRow = ({ emp, index, max }: LeaderRowProps) => {
  const percent = max > 0
    ? Math.min(100, roundPercent(calcPercent(toDecimal(emp.amount), toDecimal(max))))
    : 0
  const isTop = index < 3
  const amountRef = useRef<HTMLDivElement>(null)

  useAnimatedValue(emp.amount, 800, amountRef, formatStandard)

  const rankColors = [
    'text-[var(--warning)] bg-[var(--warning)]/15',
    'text-[var(--muted-foreground)] bg-[var(--muted)]',
    'text-[var(--primary)] bg-[var(--primary)]/15',
  ]
  const rankStyle = rankColors[index] || 'text-[var(--muted-foreground)] bg-transparent'

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-[2vh] py-[1vh] border-b border-[var(--border)] last:border-0 animate-fadeIn">
      <div className={`w-[4vh] h-[4vh] rounded-xl flex items-center justify-center text-[2vh] font-bold ${rankStyle} transition-all duration-300`}>
        {index + 1}
      </div>

      <div className="flex flex-col justify-center overflow-hidden min-w-0">
        <div className={`text-[2.2vh] font-bold truncate leading-tight mb-[0.5vh] ${isTop ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
          {emp.name}
        </div>
        <div className="h-[0.6vh] w-full bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${index === 0 ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="text-right whitespace-nowrap">
        <div
          ref={amountRef}
          className={`text-[2.5vh] font-bold font-mono tabular-nums leading-none ${isTop ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'} transition-colors duration-300`}
        >
          {formatStandard(emp.amount)}
        </div>
      </div>
    </div>
  )
}

const StatCard = ({ label, value, suffix, icon: Icon, badge, highlight }: StatCardProps) => {
  const valueRef = useRef<HTMLDivElement>(null)
  const formatValue = useCallback((num: number) => (suffix ? `${num}${suffix}` : String(num)), [suffix])
  const displayValue = formatValue(Math.round(value))

  useAnimatedValue(Math.round(value), 1000, valueRef, formatValue)

  const badgeTone = badge?.tone ?? 'success'
  const badgeClass =
    badgeTone === 'danger'
      ? 'text-[var(--danger)] bg-[var(--danger)]/15'
      : badgeTone === 'warning'
        ? 'text-[var(--warning)] bg-[var(--warning)]/15'
        : 'text-[var(--success)] bg-[var(--success)]/15'

  return (
    <div className="bg-[var(--card)] rounded-[3vh] p-[2.5vh] flex flex-col justify-between relative overflow-hidden shadow-[var(--shadow-sm)] border border-[var(--border)] animate-fadeIn transition-colors">
      {highlight && (
        <div className="absolute inset-0 border-[0.4vh] border-[var(--primary)]/15 rounded-[3vh] pointer-events-none animate-pulse" />
      )}
      <div className="flex justify-between items-start">
        <div className="text-[1.8vh] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">{label}</div>
        <Icon className={`w-[3vh] h-[3vh] transition-colors duration-500 ${highlight ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`} />
      </div>
      <div className="flex items-end gap-[1.5vh]">
        <div
          ref={valueRef}
          className={`text-[6.5vh] font-bold leading-none tabular-nums tracking-tight transition-colors duration-300 ${highlight ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}
        >
          {displayValue}
        </div>
        {badge && (
          <div className={`text-[1.8vh] font-bold mb-[1vh] px-[1vh] py-[0.2vh] rounded-md ${badgeClass}`}>
            {badge.text}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TVDashboardNew() {
  const [data, setData] = useState<TVData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [time, setTime] = useState(new Date())
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const revenueRef = useRef<HTMLSpanElement>(null)

  const revenue = data?.summary.sales ?? 0
  const plan = data?.summary.plan ?? 0

  useAnimatedValue(revenue, 1500, revenueRef, formatCompact)

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const response = await fetch('/api/tv-snapshot')
        if (!response.ok) return
        const initialData = await response.json()
        setData(initialData)
      } catch (error) {
        logError('Failed to fetch TV snapshot', error)
      }
    }

    fetchSnapshot()
  }, [])

  useEffect(() => {
    let eventSource: EventSource | null = null

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/tv')

        eventSource.onopen = () => {
          setIsConnected(true)
        }

        eventSource.onmessage = (event) => {
          try {
            const newData = JSON.parse(event.data)
            setData(newData)
          } catch (error) {
            logError('Failed to parse SSE data', error)
          }
        }

        eventSource.onerror = () => {
          setIsConnected(false)
          eventSource?.close()
          reconnectRef.current = setTimeout(connectSSE, 5000)
        }
      } catch (error) {
        logError('Failed to create SSE connection', error)
        reconnectRef.current = setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
      }
      eventSource?.close()
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!data) {
    return <LoadingScreen />
  }

  const progressPercent = plan > 0
    ? Math.min(100, roundPercent(calcPercent(toDecimal(revenue), toDecimal(plan))))
    : 0

  const leaderboard = data.leaderboard.map((emp) => ({
    id: emp.id,
    name: emp.name,
    amount: emp.sales,
    avatar: getInitials(emp.name),
  }))

  const funnelMap = new Map(data.funnel.map((stage) => [stage.id, stage]))
  const stageCards = [
    funnelMap.get('zoom1Held'),
    funnelMap.get('zoom2Held'),
    funnelMap.get('deal'),
  ].filter((stage): stage is TVFunnelStage => Boolean(stage))

  const periodLabel = `${new Date(data.period.start).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${new Date(data.period.end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`

  return (
    <div className="h-screen w-screen bg-[var(--background)] text-[var(--foreground)] font-sans overflow-hidden flex flex-col p-[3vh] transition-colors">
      <header className="h-[6vh] flex justify-between items-end px-[1vh] mb-[2vh]">
        <div className="flex flex-col gap-[0.4vh]">
          <h1 className="text-[2.2vh] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Sales Department
          </h1>
          <span className="text-[1.6vh] text-[var(--muted-foreground)] uppercase tracking-[0.15em]">
            Период: {periodLabel}
          </span>
        </div>
        <div className="flex items-center gap-[2vh]">
          <span className="text-[2.2vh] font-medium text-[var(--muted-foreground)] uppercase tracking-widest">
            {time.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <span className="text-[3vh] font-bold tabular-nums text-[var(--foreground)]">
            {time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 grid-rows-8 gap-[2.5vh]">
        <div className="col-span-8 row-span-4 bg-[var(--card)] rounded-[3vh] relative overflow-hidden flex flex-col justify-center items-center shadow-[var(--shadow-md)] border border-[var(--border)] transition-colors">
          <div
            className="absolute bottom-0 left-0 w-full bg-[var(--primary)]/10 transition-all duration-[2000ms] ease-out z-0"
            style={{ height: `${progressPercent}%` }}
          />

          <div className="relative z-10 flex flex-col items-center text-center w-full px-4 animate-fadeIn">
            <div className="text-[2.5vh] font-bold text-[var(--muted-foreground)] uppercase tracking-[0.15em] mb-[1vh]">
              Выручка команды
            </div>

            <div className="flex items-baseline justify-center gap-[1vh] leading-none">
              <span
                ref={revenueRef}
                className="text-[16vh] font-bold tracking-tight tabular-nums text-[var(--foreground)] transition-all duration-500"
              >
                {formatCompact(revenue)}
              </span>
              <span className="text-[6vh] font-medium text-[var(--muted-foreground)]">₽</span>
            </div>

            <div className="mt-[4vh] flex items-center gap-[1.5vh] bg-[var(--card)]/80 backdrop-blur-md px-[3vh] py-[1.2vh] rounded-full border border-[var(--border)] shadow-sm">
              <Target className="w-[2.5vh] h-[2.5vh] text-[var(--primary)] animate-pulse" />
              <span className="text-[2vh] font-semibold text-[var(--foreground)] tabular-nums">
                {plan > 0 ? `План: ${formatCompact(plan)} ₽ (${Math.round(progressPercent)}%)` : 'План не задан'}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-4 row-span-4 bg-[var(--card)] rounded-[3vh] p-[3vh] flex flex-col shadow-[var(--shadow-md)] border border-[var(--border)] transition-colors">
          <div className="flex justify-between items-center mb-[2vh] pb-[2vh] border-b border-[var(--border)]">
            <h2 className="text-[2.5vh] font-bold text-[var(--foreground)]">Лидеры</h2>
            <div className="bg-[var(--primary)]/10 text-[var(--primary)] px-[1.5vh] py-[0.5vh] rounded-full text-[1.5vh] font-bold uppercase tracking-wider">
              Top 5
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-[1vh]">
            {leaderboard.map((emp, index) => (
              <LeaderRow
                key={emp.id}
                emp={emp}
                index={index}
                max={leaderboard[0]?.amount || 1}
              />
            ))}
          </div>
        </div>

        <div className="col-span-8 row-span-2 grid grid-cols-3 gap-[2.5vh]">
          {stageCards.map((stage, index) => (
            <StatCard
              key={stage.id}
              label={stage.label}
              value={stage.conversion}
              suffix="%"
              icon={index === 0 ? TrendingUp : index === 1 ? ArrowUpRight : Target}
              badge={{
                text: `цель ${formatPercent(stage.benchmark)}`,
                tone: stage.isRedZone ? 'danger' : 'success',
              }}
              highlight={index === 2}
            />
          ))}
        </div>

        <div className="col-span-8 row-span-2 bg-[var(--card)] rounded-[3vh] p-[3vh] flex flex-col shadow-[var(--shadow-md)] border border-[var(--border)] transition-colors">
          <div className="flex justify-between items-center mb-[2vh] pb-[2vh] border-b border-[var(--border)]">
            <h2 className="text-[2.2vh] font-bold text-[var(--foreground)]">Сделки за 24 часа</h2>
            <div className="text-[1.6vh] font-semibold text-[var(--muted-foreground)]">
              {data.recentDeals.length} событий
            </div>
          </div>

          {data.recentDeals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[2vh] text-[var(--muted-foreground)]">
              Нет новых сделок за последние 24 часа
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-[1vh]">
              {data.recentDeals.slice(0, 6).map((deal) => (
                <div key={deal.id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-[1vh] last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-[2vh] font-semibold text-[var(--foreground)]">
                      {deal.userName}
                    </span>
                    <span className="text-[1.6vh] text-[var(--muted-foreground)]">
                      {deal.deals} сделок · {formatTimeAgo(deal.createdAt)}
                    </span>
                  </div>
                  <div className="text-[2.2vh] font-bold text-[var(--primary)] tabular-nums">
                    {formatCompact(deal.amount)} ₽
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-4 row-span-4 bg-[var(--card)] rounded-[3vh] p-[3vh] flex flex-col shadow-[var(--shadow-md)] border border-[var(--border)] transition-colors">
          <div className="flex justify-between items-center mb-[2vh] pb-[2vh] border-b border-[var(--border)]">
            <div className="flex items-center gap-[1vh]">
              <AlertTriangle className="w-[2.4vh] h-[2.4vh] text-[var(--danger)]" />
              <h2 className="text-[2.2vh] font-bold text-[var(--foreground)]">Красные зоны</h2>
            </div>
            <div className="text-[1.5vh] font-semibold text-[var(--muted-foreground)]">
              {data.redZones.length}
            </div>
          </div>

          {data.redZones.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[2vh] text-[var(--muted-foreground)]">
              Всё в норме
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-[1.4vh]">
              {data.redZones.map((zone) => (
                <div key={zone.id} className="flex items-start justify-between gap-[1vh] rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-[1.5vh] py-[1.2vh]">
                  <div className="min-w-0">
                    <div className="text-[2vh] font-semibold text-[var(--foreground)] truncate">
                      {zone.name}
                    </div>
                    <div className="text-[1.6vh] text-[var(--muted-foreground)] truncate">
                      {zone.stage}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[2vh] font-bold text-[var(--danger)]">
                      {formatPercent(zone.conversion)}
                    </div>
                    <div className="text-[1.4vh] text-[var(--muted-foreground)]">
                      цель {formatPercent(zone.benchmark)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-[var(--card)]/90 backdrop-blur-md rounded-full border border-[var(--border)] shadow-lg transition-colors">
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--danger)]'}`} />
        <span className="text-sm font-medium text-[var(--foreground)]">
          {isConnected ? 'Live' : 'Reconnecting...'}
        </span>
      </div>

      <Toaster position="top-right" expand={true} richColors closeButton />
    </div>
  )
}
