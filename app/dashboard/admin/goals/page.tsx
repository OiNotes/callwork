'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { formatMoney } from '@/lib/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/SkeletonTable'

type GoalRow = {
  id: string
  name: string
  email: string
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
  monthlyGoal: number
}

type GoalHistoryEntry = {
  id: string
  createdAt: string
  user: { id: string; name: string; email: string; role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN' } | null
  targetUser: { id: string; name: string; email: string; role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN' } | null
  metadata: Record<string, unknown> | null
}

type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const MAX_MONEY = 1_000_000_000
const HISTORY_PAGE_SIZE = 30

const parseGoalInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null as number | null, error: null as string | null }
  }
  const normalized = trimmed.replace(',', '.').replace(/\s+/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return { value: null, error: 'Введите корректное число' }
  }
  if (parsed < 0 || parsed > MAX_MONEY) {
    return { value: null, error: 'Цель должна быть от 0 до 1 000 000 000' }
  }
  return { value: parsed, error: null }
}

const getMetadataNumber = (metadata: Record<string, unknown> | null, key: string) => {
  if (!metadata || typeof metadata[key] !== 'number') return null
  return metadata[key] as number
}

export default function AdminGoalsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [goals, setGoals] = useState<GoalRow[]>([])
  const [draftGoals, setDraftGoals] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState<GoalHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPagination, setHistoryPagination] = useState<PaginationMeta | null>(null)
  const [importing, setImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated' && !isManager) {
      router.replace('/dashboard')
    }
  }, [status, isManager, router])

  const loadGoals = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/goals')
      if (response.ok) {
        const data = await response.json()
        const items = data.goals ?? []
        setGoals(items)
        const nextDrafts: Record<string, string> = {}
        items.forEach((item: GoalRow) => {
          nextDrafts[item.id] = item.monthlyGoal > 0 ? String(item.monthlyGoal) : ''
        })
        setDraftGoals(nextDrafts)
      } else {
        const error = await response.json().catch(() => null)
        setErrorMessage(error?.error ?? 'Не удалось загрузить цели')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) {
      setHistoryLoadingMore(true)
    } else {
      setHistoryLoading(true)
    }
    try {
      const response = await fetch(`/api/admin/goals/history?page=${pageToLoad}&limit=${HISTORY_PAGE_SIZE}`)
      if (response.ok) {
        const data = await response.json()
        const items = Array.isArray(data.data) ? data.data : []
        setHistory((prev) => (append ? [...prev, ...items] : items))
        setHistoryPagination(data.pagination ?? null)
        setHistoryPage(pageToLoad)
      }
    } finally {
      if (append) {
        setHistoryLoadingMore(false)
      } else {
        setHistoryLoading(false)
      }
    }
  }, [])

  const handleLoadMoreHistory = useCallback(() => {
    if (!historyPagination?.hasNext || historyLoadingMore) return
    loadHistory(historyPage + 1, true)
  }, [historyPagination?.hasNext, historyLoadingMore, historyPage, loadHistory])

  useEffect(() => {
    if (status === 'authenticated' && isManager) {
      loadGoals()
      loadHistory(1)
    }
  }, [status, isManager, loadGoals, loadHistory])

  const hasChanges = useMemo(() => {
    return goals.some((goal) => {
      const input = draftGoals[goal.id] ?? ''
      const parsed = parseGoalInput(input)
      if (parsed.error) return false
      return (parsed.value ?? 0) !== goal.monthlyGoal
    })
  }, [goals, draftGoals])

  const handleGoalChange = useCallback((userId: string, value: string) => {
    setDraftGoals((prev) => ({ ...prev, [userId]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setErrorMessage(null)
    const updates = []
    for (const goal of goals) {
      const input = draftGoals[goal.id] ?? ''
      const parsed = parseGoalInput(input)
      if (parsed.error) {
        setErrorMessage(`Ошибка в цели для ${goal.name}: ${parsed.error}`)
        return
      }
      const nextValue = parsed.value
      if ((nextValue ?? 0) !== goal.monthlyGoal) {
        updates.push({ userId: goal.id, monthlyGoal: nextValue })
      }
    }

    if (updates.length === 0) {
      setErrorMessage('Нет изменений для сохранения')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (response.ok) {
        await loadGoals()
        await loadHistory(1)
      } else {
        const error = await response.json().catch(() => null)
        setErrorMessage(error?.error ?? 'Не удалось сохранить цели')
      }
    } finally {
      setIsSaving(false)
    }
  }, [goals, draftGoals, loadGoals, loadHistory])

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setErrorMessage(null)
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/admin/goals/import', {
        method: 'POST',
        body: formData,
      })
      if (response.ok) {
        await loadGoals()
        await loadHistory(1)
      } else {
        const error = await response.json().catch(() => null)
        const details = Array.isArray(error?.details) ? error.details.join('\n') : null
        setErrorMessage(details ? `${error?.error}\n${details}` : error?.error ?? 'Ошибка импорта')
      }
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [loadGoals, loadHistory])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 w-40 rounded-full bg-[var(--muted)]/40 animate-pulse" />
          <SkeletonTable rows={6} columns={4} />
        </div>
      </DashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Цели команды</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Массовое редактирование месячных целей и история изменений.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              type="button"
              onClick={triggerImport}
              disabled={importing}
              className="px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-60"
            >
              {importing ? 'Импорт...' : 'Импорт из Excel/CSV'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:opacity-60"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-[12px] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)] whitespace-pre-line">
            {errorMessage}
          </div>
        )}

        <div className="glass-card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-lg font-semibold">Список целей</h2>
            <span className="text-xs text-[var(--muted-foreground)]">
              Колонка: email, monthlyGoal
            </span>
          </div>
          {isLoading ? (
            <div className="p-6">
              <SkeletonTable rows={6} columns={4} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--secondary)]/60 text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-6 py-3">Сотрудник</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Роль</th>
                    <th className="px-6 py-3 text-right">Цель, ₽</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {goals.map((goal) => (
                    <tr key={goal.id} className="hover:bg-[var(--muted)]/40 transition-colors">
                      <td className="px-6 py-3 font-medium text-[var(--foreground)]">{goal.name}</td>
                      <td className="px-6 py-3 text-[var(--muted-foreground)]">{goal.email}</td>
                      <td className="px-6 py-3 text-[var(--muted-foreground)]">
                        {goal.role === 'ADMIN'
                          ? 'Администратор'
                          : goal.role === 'MANAGER'
                            ? 'Менеджер'
                            : 'Сотрудник'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <input
                          value={draftGoals[goal.id] ?? ''}
                          onChange={(event) => handleGoalChange(goal.id, event.target.value)}
                          className="w-40 text-right px-3 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                          placeholder="0"
                        />
                        {goal.monthlyGoal > 0 && (
                          <div className="text-xs text-[var(--muted-foreground)] mt-1">
                            Сейчас: {formatMoney(goal.monthlyGoal)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold">История изменений</h2>
          </div>
          {historyLoading ? (
            <div className="p-6 text-sm text-[var(--muted-foreground)]">Загрузка...</div>
          ) : history.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="История пока пуста"
                description="Изменения целей появятся здесь после первого обновления."
                actionLabel=""
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--secondary)]/60 text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-6 py-3">Сотрудник</th>
                    <th className="px-6 py-3">Изменил</th>
                    <th className="px-6 py-3">Было</th>
                    <th className="px-6 py-3">Стало</th>
                    <th className="px-6 py-3">Источник</th>
                    <th className="px-6 py-3 text-right">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {history.map((entry) => {
                    const previousGoal = getMetadataNumber(entry.metadata, 'previousGoal')
                    const newGoal = getMetadataNumber(entry.metadata, 'newGoal')
                    const source = typeof entry.metadata?.source === 'string'
                      ? entry.metadata.source
                      : 'manual'

                    return (
                      <tr key={entry.id} className="hover:bg-[var(--muted)]/40 transition-colors">
                        <td className="px-6 py-3">
                          {entry.targetUser?.name ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-[var(--muted-foreground)]">
                          {entry.user?.name ?? '—'}
                        </td>
                        <td className="px-6 py-3">
                          {previousGoal !== null ? formatMoney(previousGoal) : '—'}
                        </td>
                        <td className="px-6 py-3">
                          {newGoal !== null ? formatMoney(newGoal) : '—'}
                        </td>
                        <td className="px-6 py-3 text-[var(--muted-foreground)]">
                          {source === 'import' ? 'Импорт' : 'Ручное'}
                        </td>
                        <td className="px-6 py-3 text-right text-[var(--muted-foreground)]">
                          {new Date(entry.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {historyPagination?.hasNext && !historyLoading && (
            <div className="px-6 py-4 border-t border-[var(--border)] flex justify-center">
              <button
                onClick={handleLoadMoreHistory}
                disabled={historyLoadingMore}
                className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                {historyLoadingMore ? 'Загрузка...' : 'Показать ещё'}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
