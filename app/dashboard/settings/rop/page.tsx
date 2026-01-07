'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ArrowLeft, Save, RefreshCw, Plus, Trash2, DollarSign, Filter, Target, Briefcase, Loader2, AlertTriangle, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence } from '@/lib/motion'
import * as Tabs from '@radix-ui/react-tabs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Decimal from 'decimal.js'
import { roundMoney, sumDecimals, toNumber } from '@/lib/utils/decimal'
import { logError } from '@/lib/logger'

type ConversionBenchmarks = {
  BOOKED_TO_ZOOM1: number | null
  ZOOM1_TO_ZOOM2: number | null
  ZOOM2_TO_CONTRACT: number | null
  CONTRACT_TO_PUSH: number | null
  PUSH_TO_DEAL: number | null
  ZOOM1_TO_DEAL_KPI: number | null
}

type AlertThresholds = { warning: number | null; critical: number | null }

type MotivationGrade = { minTurnover: number | null; maxTurnover?: number | null; commissionRate: number | null }

interface EffectiveSettings {
  departmentGoal: number | null
  conversionBenchmarks: ConversionBenchmarks
  alertThresholds: AlertThresholds
  alertNoReportDays: number | null
  alertNoDealsDays: number | null
  alertConversionDrop: number | null
  telegramRegistrationTtl: number | null
  telegramReportTtl: number | null
  activityScoreTarget: number | null
  northStarTarget: number | null
  salesPerDeal: number | null
  motivationGrades: MotivationGrade[]
  periodStartDay: number | null
}

interface ManagerPlan {
  id: string
  name: string
  monthlyGoal: number | null
}

const numberFormat = new Intl.NumberFormat('ru-RU')

export default function RopSettingsPage() {
  const [settings, setSettings] = useState<EffectiveSettings | null>(null)
  const [managerPlans, setManagerPlans] = useState<ManagerPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('finance')
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderVisible(window.scrollY < 50)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/rop-settings')
        if (!res.ok) throw new Error('Не удалось загрузить настройки')
        const json = await res.json()
        setSettings(json.settings)
        const managers = Array.isArray(json.managers) ? (json.managers as ManagerPlan[]) : []
        setManagerPlans(
          managers.map((m) => ({
            id: m.id,
            name: m.name,
            monthlyGoal: typeof m.monthlyGoal === 'number' ? m.monthlyGoal : null,
          }))
        )
      } catch (error) {
        logError('Failed to fetch ROP settings', error)
        toast.error('Не удалось загрузить настройки')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const parseNumberOrNull = (value: string): number | null => {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const normalized = trimmed.replace(',', '.')
    try {
      const decimal = new Decimal(normalized)
      if (!decimal.isFinite()) return null
      return decimal.toNumber()
    } catch {
      return null
    }
  }

  const handleBenchmarkChange = (key: keyof ConversionBenchmarks, value: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      conversionBenchmarks: { ...settings.conversionBenchmarks, [key]: parseNumberOrNull(value) },
    })
  }

  const handleAlertChange = (key: keyof AlertThresholds, value: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      alertThresholds: { ...settings.alertThresholds, [key]: parseNumberOrNull(value) },
    })
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const sanitizedBenchmarks = Object.fromEntries(
        Object.entries(settings.conversionBenchmarks).flatMap(([key, value]) =>
          typeof value === 'number' && Number.isFinite(value) ? [[key, value]] : []
        )
      )

      const sanitizedAlert: AlertThresholds = {
        warning:
          typeof settings.alertThresholds.warning === 'number' && Number.isFinite(settings.alertThresholds.warning)
            ? settings.alertThresholds.warning
            : null,
        critical:
          typeof settings.alertThresholds.critical === 'number' && Number.isFinite(settings.alertThresholds.critical)
            ? settings.alertThresholds.critical
            : null,
      }

      const payload = {
        ...settings,
        conversionBenchmarks: sanitizedBenchmarks,
        alertThresholds: sanitizedAlert,
        managerPlans: managerPlans.map((m) => ({
          ...m,
          monthlyGoal: m.monthlyGoal,
        })),
      }

      const res = await fetch('/api/rop-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Не удалось сохранить')
      }
      const json = await res.json()
      setSettings(json.settings)
      toast.success('Настройки успешно применены')
    } catch (error) {
      logError('Failed to update ROP settings', error)
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleGradeChange = (index: number, field: keyof MotivationGrade, value: string | null) => {
    if (!settings) return
    
    let numValue: number | null = null
    if (value !== null) {
      if (field === 'commissionRate') {
        numValue = parseNumberOrNull(value)
        numValue = numValue !== null ? numValue / 100 : null
      } else {
        numValue = parseNumberOrNull(value)
      }
    }

    const next = settings.motivationGrades.map((grade, idx) =>
      idx === index ? { ...grade, [field]: numValue } : grade
    )
    setSettings({ ...settings, motivationGrades: next })
  }

  const addGradeRow = useCallback(() => {
    setSettings((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        motivationGrades: [
          ...prev.motivationGrades,
          { minTurnover: 0, maxTurnover: null, commissionRate: 0 },
        ],
      }
    })
  }, [])

  const removeGradeRow = useCallback((index: number) => {
    setSettings((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        motivationGrades: prev.motivationGrades.filter((_, idx) => idx !== index),
      }
    })
  }, [])

  const handleReload = useCallback(() => {
    window.location.reload()
  }, [])

  const handleRemoveGradeClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const indexValue = event.currentTarget.dataset.gradeIndex
    if (!indexValue) return
    const index = Number(indexValue)
    if (Number.isNaN(index)) return
    removeGradeRow(index)
  }, [removeGradeRow])

  if (loading || !settings) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
            <p className="text-[var(--muted-foreground)]">Загрузка настроек...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const tabs = [
    { id: 'finance', label: 'Финансы', icon: DollarSign },
    { id: 'funnel', label: 'Воронка', icon: Filter },
    { id: 'kpi', label: 'KPI', icon: Target },
    { id: 'motivation', label: 'Мотивация', icon: Briefcase },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
        {/* Floating Full-Width Header */}
        <motion.div
          layout
          ref={headerRef}
          animate={{
            opacity: isHeaderVisible ? 1 : 0,
            y: isHeaderVisible ? 0 : -20,
            pointerEvents: isHeaderVisible ? 'auto' : 'none'
          }}
          transition={{ duration: 0.3 }}
          className="relative z-30 bg-[var(--background)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/75 py-4 border-b border-[var(--border)] -mx-4 px-4 sm:-mx-8 sm:px-8 mb-8 transition-colors"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col gap-2"
            >
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Назад</span>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">Настройки РОПа</h1>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Управление планами и мотивацией
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex gap-3"
            >
              <button
                onClick={handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] bg-[var(--card)] hover:bg-[var(--secondary)] transition-all duration-200 text-sm font-medium shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Обновить</span>
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* Main Content Title Area (Below Floating Header) */}
        <div className="space-y-1 pt-2">
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
            Конфигурация отдела
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Настройте ключевые параметры работы отдела продаж
          </p>
        </div>

        {/* Tabs */}
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="flex flex-wrap gap-2 mb-8 p-1 bg-[var(--secondary)]/50 rounded-[16px] w-fit border border-[var(--border)]">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-medium text-[var(--muted-foreground)] transition-all duration-200 data-[state=active]:bg-[var(--card)] data-[state=active]:text-[var(--primary)] data-[state=active]:shadow-sm hover:text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <Icon className="w-4 h-4 group-data-[state=active]:text-[var(--primary)]" />
                  {tab.label}
                </Tabs.Trigger>
              )
            })}
          </Tabs.List>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Finance Tab */}
                <Tabs.Content value="finance" className="outline-none">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass-card rounded-[24px] p-8 border border-[var(--border)] space-y-8">
                      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[var(--foreground)]">Общий план</h2>
                          <p className="text-sm text-[var(--muted-foreground)]">Финансовые цели отдела</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            План отдела, ₽
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full"
                            value={settings.departmentGoal ?? ''}
                            onChange={(e) =>
                              setSettings({ ...settings, departmentGoal: parseNumberOrNull(e.target.value) })
                            }
                            min={0}
                            step={10000}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Начало периода (день месяца)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full"
                            value={settings.periodStartDay ?? ''}
                            onChange={(e) =>
                              setSettings({ ...settings, periodStartDay: parseNumberOrNull(e.target.value) })
                            }
                            min={1}
                            max={31}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="glass-card rounded-[24px] p-8 border border-[var(--border)] space-y-8">
                      <div className="flex items-center justify-between pb-6 border-b border-[var(--border)]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                            <Target className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-[var(--foreground)]">Планы менеджеров</h2>
                            <p className="text-sm text-[var(--muted-foreground)]">Индивидуальные цели</p>
                          </div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-sm text-[var(--muted-foreground)]">Всего</div>
                          <div className="text-xl font-bold text-[var(--primary)]">
                            {numberFormat.format(
                              toNumber(roundMoney(sumDecimals(managerPlans.map((m) => m.monthlyGoal || 0))))
                            )} ₽
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {managerPlans.map((manager) => (
                          <div key={manager.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--secondary)]/30 border border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-[var(--card)] flex items-center justify-center text-sm font-bold border border-[var(--border)] shadow-sm">
                              {manager.name.charAt(0)}
                            </div>
                            <div className="flex-1 font-medium text-[var(--foreground)] text-lg">
                              {manager.name}
                            </div>
                            <input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              className="input-premium w-40 text-right font-medium"
                              value={manager.monthlyGoal ?? ''}
                              onChange={(e) =>
                                setManagerPlans((prev) =>
                                  prev.map((m) => (m.id === manager.id ? { ...m, monthlyGoal: parseNumberOrNull(e.target.value) } : m))
                                )
                              }
                              min={0}
                              step={50000}
                              placeholder="0 ₽"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Funnel Tab */}
                <Tabs.Content value="funnel" className="outline-none">
                  <div className="glass-card rounded-[24px] p-8 border border-[var(--border)]">
                    <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[var(--border)]">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                        <Filter className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">Нормы конверсий</h2>
                        <p className="text-sm text-[var(--muted-foreground)]">Эталонные показатели воронки продаж (%)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                      {[
                        ['BOOKED_TO_ZOOM1', 'Запись → 1-й Zoom'],
                        ['ZOOM1_TO_ZOOM2', '1-й Zoom → 2-й Zoom'],
                        ['ZOOM2_TO_CONTRACT', '2-й Zoom → Разбор'],
                        ['CONTRACT_TO_PUSH', 'Договор → Дожим'],
                        ['PUSH_TO_DEAL', 'Дожим → Оплата'],
                        ['ZOOM1_TO_DEAL_KPI', '1-й Zoom → Оплата (North Star)'],
                      ].map(([key, label]) => (
                        <div key={key as string} className="group p-6 rounded-[20px] bg-[var(--secondary)]/30 border border-[var(--border)] hover:border-[var(--primary)]/50 transition-all hover:shadow-lg hover:shadow-[var(--primary)]/5">
                          <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-3 group-hover:text-[var(--primary)] transition-colors">
                            {label}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              className="input-premium w-full font-bold text-xl h-14"
                              value={settings.conversionBenchmarks[key as keyof ConversionBenchmarks] ?? ''}
                              onChange={(e) => handleBenchmarkChange(key as keyof ConversionBenchmarks, e.target.value)}
                              min={0}
                              max={100}
                              step={1}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] font-medium">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Tabs.Content>

                {/* KPI Tab */}
                <Tabs.Content value="kpi" className="outline-none">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass-card rounded-[24px] p-8 border border-[var(--border)] space-y-8">
                      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                          <Target className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[var(--foreground)]">Целевые показатели</h2>
                          <p className="text-sm text-[var(--muted-foreground)]">Ключевые метрики эффективности</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Цель активности
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              className="input-premium w-full"
                              value={settings.activityScoreTarget ?? ''}
                              onChange={(e) =>
                                setSettings({ ...settings, activityScoreTarget: parseNumberOrNull(e.target.value) })
                              }
                              min={0}
                              max={100}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            North Star Target
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              className="input-premium w-full"
                              value={settings.northStarTarget ?? ''}
                              onChange={(e) =>
                                setSettings({ ...settings, northStarTarget: parseNumberOrNull(e.target.value) })
                              }
                              min={0}
                              max={100}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card rounded-[24px] p-8 border border-[var(--border)] space-y-8">
                      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--danger)]/10 flex items-center justify-center text-[var(--danger)]">
                          <Target className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[var(--foreground)]">Пороги алертов</h2>
                          <p className="text-sm text-[var(--muted-foreground)]">Уровни срабатывания предупреждений</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl bg-[var(--warning)]/10 border border-[var(--warning)]/20">
                          <label className="block text-sm font-bold text-[var(--warning)] mb-3">
                            Жёлтая зона (Warning)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="w-full rounded-[var(--radius-md)] border border-[var(--warning)]/30 bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--warning)] shadow-sm"
                            value={settings.alertThresholds.warning ?? ''}
                            onChange={(e) => handleAlertChange('warning', e.target.value)}
                            min={0}
                            max={1}
                            step={0.05}
                          />
                          <p className="text-xs text-[var(--muted-foreground)] mt-3 opacity-80">Доля от нормы для предупреждения</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-[var(--danger)]/10 border border-[var(--danger)]/20">
                          <label className="block text-sm font-bold text-[var(--danger)] mb-3">
                            Красная зона (Critical)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="w-full rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--danger)] shadow-sm"
                            value={settings.alertThresholds.critical ?? ''}
                            onChange={(e) => handleAlertChange('critical', e.target.value)}
                            min={0}
                            max={1}
                            step={0.05}
                          />
                          <p className="text-xs text-[var(--muted-foreground)] mt-3 opacity-80">Доля от нормы для тревоги</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card rounded-[24px] p-8 border border-[var(--border)] space-y-8">
                      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--warning)]/10 flex items-center justify-center text-[var(--warning)]">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[var(--foreground)]">Авто-алерты</h2>
                          <p className="text-sm text-[var(--muted-foreground)]">Триггеры для CRON оповещений</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Нет отчётов (дней)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full"
                            value={settings.alertNoReportDays ?? ''}
                            onChange={(e) =>
                              setSettings({ ...settings, alertNoReportDays: parseNumberOrNull(e.target.value) })
                            }
                            min={0}
                            max={60}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Нет сделок (дней)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full"
                            value={settings.alertNoDealsDays ?? ''}
                            onChange={(e) =>
                              setSettings({ ...settings, alertNoDealsDays: parseNumberOrNull(e.target.value) })
                            }
                            min={0}
                            max={60}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Падение конверсии (%)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              className="input-premium w-full"
                              value={settings.alertConversionDrop ?? ''}
                              onChange={(e) =>
                                setSettings({ ...settings, alertConversionDrop: parseNumberOrNull(e.target.value) })
                              }
                              min={0}
                              max={100}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card rounded-[24px] p-8 border border-[var(--border)] space-y-8">
                      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                          <MessageCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[var(--foreground)]">Telegram</h2>
                          <p className="text-sm text-[var(--muted-foreground)]">Время жизни сессий бота</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Регистрация (мин)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full"
                            value={settings.telegramRegistrationTtl ?? ''}
                            onChange={(e) =>
                              setSettings({ ...settings, telegramRegistrationTtl: parseNumberOrNull(e.target.value) })
                            }
                            min={1}
                            max={180}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Отчёт (мин)
                          </label>
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full"
                            value={settings.telegramReportTtl ?? ''}
                            onChange={(e) =>
                              setSettings({ ...settings, telegramReportTtl: parseNumberOrNull(e.target.value) })
                            }
                            min={1}
                            max={180}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Motivation Tab */}
                <Tabs.Content value="motivation" className="outline-none">
                  <div className="glass-card rounded-[24px] p-8 border border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-[var(--border)]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                          <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[var(--foreground)]">Грейды мотивации</h2>
                          <p className="text-sm text-[var(--muted-foreground)]">Зависимость комиссии от оборота</p>
                        </div>
                      </div>
                      <button
                        onClick={addGradeRow}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition-all duration-200 text-sm font-medium shadow-sm border border-[var(--border)]"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить грейд
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-6 px-4 py-3 bg-[var(--secondary)]/50 rounded-xl text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider border border-[var(--border)]">
                        <div className="col-span-4">Минимальный оборот</div>
                        <div className="col-span-4">Максимальный оборот</div>
                        <div className="col-span-3">Ставка</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Table Body */}
                      <div className="space-y-2">
                        <AnimatePresence initial={false}>
                          {settings.motivationGrades.map((grade, idx) => (
                            <motion.div
                              key={`${grade.minTurnover ?? 'min'}-${grade.maxTurnover ?? 'max'}-${grade.commissionRate ?? 'rate'}-${idx}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid grid-cols-12 gap-6 items-center p-2 rounded-xl transition-colors"
                            >
                              <div className="col-span-4">
                                <input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  className="input-premium w-full"
                                  value={grade.minTurnover ?? ''}
                                  onChange={(e) => handleGradeChange(idx, 'minTurnover', e.target.value)}
                                  min={0}
                                  step={50000}
                                />
                              </div>
                              <div className="col-span-4">
                                <input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  className="input-premium w-full placeholder-[var(--muted-foreground)]"
                                  value={grade.maxTurnover ?? ''}
                                  onChange={(e) =>
                                    handleGradeChange(
                                      idx,
                                      'maxTurnover',
                                      e.target.value === '' ? null : e.target.value
                                    )
                                  }
                                  min={0}
                                  step={50000}
                                  placeholder="∞"
                                />
                              </div>
                              <div className="col-span-3">
                                <div className="relative">
                                  <input
                                    type="number"
                                    onFocus={(e) => e.target.select()}
                                  className="input-premium w-full font-medium"
                                  value={grade.commissionRate === null ? '' : (grade.commissionRate ?? 0) * 100}
                                  onChange={(e) => handleGradeChange(idx, 'commissionRate', e.target.value)}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">%</span>
                                </div>
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <button
                                  data-grade-index={idx}
                                  onClick={handleRemoveGradeClick}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="mt-8 p-6 rounded-[20px] bg-[var(--secondary)]/30 border border-[var(--border)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                          <label className="block text-base font-medium text-[var(--foreground)] mb-1">
                            Эвристика: средний чек сделки
                          </label>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            Используется для расчёта планового количества сделок
                          </p>
                        </div>
                        <div className="relative w-full sm:w-56">
                          <input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            className="input-premium w-full text-lg font-medium"
                            value={settings.salesPerDeal ?? ''}
                            onChange={(e) => setSettings({ ...settings, salesPerDeal: parseNumberOrNull(e.target.value) })}
                            min={1}
                            step={10000}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">₽</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs.Root>

        {/* Footer Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end pt-4 pb-8"
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-[var(--primary-foreground)] hover:shadow-lg hover:shadow-[var(--primary)]/25 hover:scale-[1.02] transition-all duration-200 font-bold text-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Применить изменения
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
