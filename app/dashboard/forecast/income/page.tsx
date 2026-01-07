'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calculator, Wallet, Zap, Check } from 'lucide-react'
import { motion } from '@/lib/motion'
import { useSession } from 'next-auth/react'
import { ManagerSelector } from '@/components/filters/ManagerSelector'
import { FocusDealsTable } from '@/components/forecast/FocusDealsTable'
import { formatMoney } from '@/lib/utils/format'
import { roundMoney, toDecimal, toNumber } from '@/lib/utils/decimal'
import { logError } from '@/lib/logger'

interface ForecastIncomeData {
  sales: {
    current: number
    projected: number
    optimistic: number
    goal: number
    focusDealsAmount: number
  }
  rates: {
    current: number
    projected: number
    optimistic: number
  }
  income: {
    current: number
    projected: number
    optimistic: number
    projectedGrowth: number
    potentialGrowth: number
  }
  grades: Array<{ min: number; percent: number }>
  deals: Array<{
    id: string
    title: string
    budget: number
    isFocus: boolean
    createdAt: string
  }>
}

export default function IncomeForecastPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<ForecastIncomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFocus, setShowFocus] = useState(false)
  
  // Manager view state
  const [team, setTeam] = useState<Array<{ id: string; name: string }>>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  // Initialize selectedUserId once session is loaded
  useEffect(() => {
    if (session?.user?.id && !selectedUserId) {
      setSelectedUserId(session.user.id)
    }
  }, [session, selectedUserId])

  // Fetch Team (if Manager)
  useEffect(() => {
    async function fetchTeam() {
      if (!isManager) return
      try {
        const res = await fetch('/api/employees?page=1&limit=100')
        if (res.ok) {
          const json = await res.json()
          setTeam(
            Array.isArray(json.data)
              ? json.data.map((emp: { id: string; name: string }) => ({
                  id: emp.id,
                  name: emp.name,
                }))
              : []
          )
        }
      } catch (e) {
        logError('Failed to fetch team', e)
      }
    }
    fetchTeam()
  }, [isManager])

  const loadForecastData = useCallback(async () => {
      if (!selectedUserId) return
      
      // Don't set loading true on refresh to avoid flickering, only on initial
      if (!data) setLoading(true)
      
      try {
        const query = selectedUserId !== session?.user?.id ? `?userId=${selectedUserId}` : ''
        const res = await fetch(`/api/forecast/income${query}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (e) {
        logError('Failed to load forecast data', e)
      } finally {
        setLoading(false)
      }
  }, [selectedUserId, session, data])

  // Initial load
  useEffect(() => {
    loadForecastData()
  }, [loadForecastData])

  const handleManagerSelect = useCallback((id: string) => {
    const fallbackId = session?.user?.id || ''
    setSelectedUserId(id === 'all' ? fallbackId : id)
  }, [session?.user?.id])

  const handleToggleScenario = useCallback(() => {
    setShowFocus((prev) => !prev)
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-6">
         {isManager && <div className="h-12 w-64 bg-[var(--muted)]/40 rounded-xl animate-pulse" />}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-64 bg-[var(--muted)]/40 rounded-2xl animate-pulse" />
            <div className="h-64 bg-[var(--muted)]/40 rounded-2xl animate-pulse" />
         </div>
      </div>
    )
  }

  const { sales, rates, income, grades, deals } = data
  
  const currentScenario = showFocus ? 'optimistic' : 'projected'
  const displayIncome = income[currentScenario]
  const displaySales = sales[currentScenario]
  const displayRate = rates[currentScenario]

  // Calculate progress to next level
  const currentGradeIndex = grades.findIndex((g) => displayRate === g.percent)
  const nextGrade = grades[currentGradeIndex + 1]
  const prevGrade = grades[currentGradeIndex]
  
  const prevMin = prevGrade ? toDecimal(prevGrade.min) : toDecimal(0)
  const displaySalesAmount = toDecimal(displaySales)
  let progressPercent = 0
  if (nextGrade) {
    const nextMin = toDecimal(nextGrade.min)
    const range = nextMin.minus(prevMin)
    const currentInGrade = displaySalesAmount.minus(prevMin)
    const rawPercent = range.greaterThan(0)
      ? toNumber(currentInGrade.dividedBy(range).times(100))
      : 0
    progressPercent = Math.min(100, Math.max(0, rawPercent))
  } else {
    progressPercent = 100 // Max level reached
  }

  const remainingToNext = nextGrade
    ? (() => {
        const remainder = toDecimal(nextGrade.min).minus(displaySalesAmount)
        return remainder.greaterThan(0) ? toNumber(roundMoney(remainder)) : 0
      })()
    : 0
  const incomeDelta = toNumber(roundMoney(toDecimal(displayIncome).minus(income.current)))

  return (
    <div className="space-y-8">
      
      {/* Manager Selector */}
      {isManager && (
        <div className="flex justify-end">
            <ManagerSelector 
                managers={team}
                selectedManagerId={selectedUserId}
                onSelectManager={handleManagerSelect}
                title="Чей доход смотрим?"
            />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Main Calculator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Hero Card */}
          <div className="glass-card p-0 relative overflow-hidden flex flex-col md:flex-row">
              {/* Left Side: Main Value */}
              <div className="p-8 flex-1 relative z-10">
                  <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Прогноз дохода</h2>
                  <div className="text-5xl font-bold text-[var(--primary)] mb-6 tracking-tight">
                      {formatMoney(displayIncome)}
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-2 bg-[var(--secondary)] px-4 py-2 rounded-xl border border-[var(--border)]">
                          <span className="text-xs text-[var(--muted-foreground)]">Оборот</span>
                          <span className="font-bold text-[var(--foreground)]">
                              {formatMoney(displaySales)}
                          </span>
                      </div>
                      <div className="flex items-center gap-2 bg-[var(--secondary)] px-4 py-2 rounded-xl border border-[var(--border)]">
                          <span className="text-xs text-[var(--muted-foreground)]">Ставка</span>
                          <span className="font-bold text-[var(--foreground)]">{(displayRate * 100).toFixed(1)}%</span>
                      </div>
                  </div>
              </div>

              {/* Right Side: Wallet Icon (Decor) */}
              <div className="relative w-full md:w-48 bg-gradient-to-br from-[var(--primary)]/10 to-transparent flex items-center justify-center p-8">
                  <Wallet className="w-24 h-24 text-[var(--primary)]/20 absolute transform rotate-12" />
                  <div className="relative z-10 text-center">
                      <span className="text-xs font-medium text-[var(--primary)] bg-[var(--card)]/80 backdrop-blur px-3 py-1 rounded-full">
                          {showFocus ? 'Оптимистичный' : 'Реалистичный'}
                      </span>
                  </div>
              </div>
          </div>
          
          {/* Progress Bar Card */}
          <div className="glass-card p-6">
               <div className="flex justify-between items-end mb-3">
                  <div>
                      <h3 className="text-sm font-bold text-[var(--foreground)]">Путь к следующему уровню</h3>
                      {nextGrade ? (
                          <p className="text-xs text-[var(--muted-foreground)] mt-1">
                              Осталось продать на <span className="font-medium text-[var(--foreground)]">{formatMoney(remainingToNext)}</span> для ставки <b>{(nextGrade.percent * 100).toFixed(0)}%</b>
                          </p>
                      ) : (
                          <p className="text-xs text-[var(--success)] mt-1">Максимальный уровень достигнут!</p>
                      )}
                  </div>
                  <span className="text-2xl font-bold text-[var(--primary)]">{progressPercent.toFixed(0)}%</span>
               </div>

               <div className="h-4 bg-[var(--secondary)] rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                      className="h-full bg-[var(--primary)] relative"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                  >
                      <div className="absolute inset-0 bg-[var(--card)]/20 animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)' }}></div>
                  </motion.div>
               </div>
          </div>

          {/* Focus Switch */}
          <div
            className="glass-card p-6 flex items-center justify-between cursor-pointer hover:bg-[var(--secondary)]/40 transition-colors"
            onClick={handleToggleScenario}
          >
              <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-colors ${showFocus ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}>
                      <Zap className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-[var(--foreground)]">Фокус-сделки</h3>
                      <p className="text-sm text-[var(--muted-foreground)]">
                          Учесть потенциал ({formatMoney(sales.focusDealsAmount)})
                      </p>
                  </div>
              </div>
              <div className={`w-14 h-7 rounded-full relative transition-colors ${showFocus ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'}`}>
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-[var(--card)] rounded-full shadow-sm transition-transform ${showFocus ? 'translate-x-7' : 'translate-x-0'}`} />
              </div>
          </div>

        </div>

        {/* Right Column: Scale & Breakdown */}
        <div className="space-y-6">
          
          <div className="glass-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-[var(--foreground)]">
                  <Calculator className="w-4 h-4 text-[var(--primary)]" />
                  Шкала мотивации
              </h3>
              <div className="space-y-2 relative">
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-[var(--border)] z-0" />
                  
                  {grades.map((grade, i) => {
                      const isReached = displaySales >= grade.min;
                      const isNext = !isReached && (i === 0 || displaySales >= grades[i-1].min);
                      
                      return (
                          <div key={`${grade.min}-${grade.percent}-${i}`} className={`relative z-10 flex items-center gap-3 p-3 rounded-xl transition-all border ${isReached ? 'bg-[var(--primary)]/10 border-[var(--primary)]/20' : isNext ? 'bg-[var(--card)] border-[var(--primary)]/30 shadow-sm' : 'bg-transparent border-transparent opacity-60'}`}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isReached ? 'bg-[var(--primary)] border-[var(--primary)]' : isNext ? 'bg-[var(--card)] border-[var(--primary)]' : 'bg-[var(--secondary)] border-[var(--border)]'}`}>
                                  {isReached && <Check className="w-2.5 h-2.5 text-[var(--primary-foreground)]" />}
                              </div>
                              <div className="flex-1 flex justify-between items-center">
                                  <span className={`text-sm ${isReached || isNext ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                                      {grade.min === 0 ? 'Старт' : `> ${new Intl.NumberFormat('ru-RU', { notation: "compact" }).format(grade.min)}`}
                                  </span>
                                  <span className={`text-sm font-bold ${isReached ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`}>
                                      {(grade.percent * 100).toFixed(0)}%
                                  </span>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>

           <div className="glass-card p-6">
               <h3 className="font-bold mb-4 text-[var(--foreground)]">Итог</h3>
               <div className="space-y-3 text-sm">
                   <div className="flex justify-between">
                       <span className="text-[var(--muted-foreground)]">Текущий факт:</span>
                       <span className="font-medium text-[var(--foreground)]">{formatMoney(income.current)}</span>
                   </div>
                    <div className="flex justify-between">
                       <span className="text-[var(--muted-foreground)]">Ожидаемый прирост:</span>
                       <span className="font-medium text-[var(--success)]">+{formatMoney(incomeDelta)}</span>
                   </div>
                   <div className="pt-3 border-t border-[var(--border)] flex justify-between text-base font-bold text-[var(--foreground)]">
                       <span>Всего к выплате:</span>
                       <span>{formatMoney(displayIncome)}</span>
                   </div>
               </div>
           </div>

        </div>
      </div>

      {/* Focus Deals Table */}
      <FocusDealsTable deals={deals} onUpdate={loadForecastData} />
    </div>
  )
}
