'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/SkeletonCard'
import { SkeletonTable } from '@/components/ui/SkeletonTable'

type UserRow = {
  id: string
  name: string
  email: string
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
  isActive: boolean
  managerId: string | null
  telegramId: string | null
  createdAt: string
  lastLoginAt: string | null
}

type RoleOption = 'EMPLOYEE' | 'MANAGER'

type CreateFormState = {
  name: string
  email: string
  role: RoleOption
  password: string
}

type EditFormState = {
  name: string
  email: string
  role: RoleOption
  isActive: boolean
  password: string
}

type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const emptyCreateForm: CreateFormState = {
  name: '',
  email: '',
  role: 'EMPLOYEE',
  password: '',
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [createForm, setCreateForm] = useState<CreateFormState>({ ...emptyCreateForm })
  const [isCreating, setIsCreating] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    email: '',
    role: 'EMPLOYEE',
    isActive: true,
    password: '',
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) return 'Нет данных'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Нет данных'
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'
  const isEditingSelf = editingUserId === session?.user?.id

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

  const loadUsers = useCallback(async (pageToLoad = 1) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/users?page=${pageToLoad}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.data ?? [])
        setPagination(data.pagination ?? null)
        setPage(pageToLoad)
        setSelectedIds(new Set())
      } else {
        const error = await response.json().catch(() => null)
        alert(error?.error ?? 'Не удалось загрузить пользователей')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isManager) {
      loadUsers()
    }
  }, [status, isManager, loadUsers])

  const selectableUserIds = useMemo(() => {
    const currentUserId = session?.user?.id
    return users
      .filter((user) => user.id !== currentUserId && user.role !== 'ADMIN')
      .map((user) => user.id)
  }, [users, session?.user?.id])

  const allSelected = useMemo(() => {
    if (selectableUserIds.length === 0) return false
    return selectableUserIds.every((id) => selectedIds.has(id))
  }, [selectableUserIds, selectedIds])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(() => {
      if (allSelected) {
        return new Set()
      }
      return new Set(selectableUserIds)
    })
  }, [allSelected, selectableUserIds])

  const toggleSelectUser = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  const handleCreateSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (response.ok) {
        setCreateForm({ ...emptyCreateForm })
        await loadUsers(page)
      } else {
        const error = await response.json().catch(() => null)
        alert(error?.error ?? 'Не удалось создать пользователя')
      }
    } finally {
      setIsCreating(false)
    }
  }, [createForm, loadUsers, page])

  const startEdit = useCallback((user: UserRow) => {
    if (user.role === 'ADMIN') {
      return
    }
    setEditingUserId(user.id)
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      password: '',
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingUserId(null)
    setEditForm({ name: '', email: '', role: 'EMPLOYEE', isActive: true, password: '' })
  }, [])

  const handleEditSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingUserId) return
    setIsUpdating(true)
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        isActive: editForm.isActive,
      }
      if (editForm.password.trim()) {
        payload.password = editForm.password
      }

      const response = await fetch(`/api/admin/users/${editingUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (response.ok) {
        await loadUsers(page)
        cancelEdit()
      } else {
        const error = await response.json().catch(() => null)
        alert(error?.error ?? 'Не удалось обновить пользователя')
      }
    } finally {
      setIsUpdating(false)
    }
  }, [editingUserId, editForm, loadUsers, cancelEdit, page])

  const deactivateUser = useCallback(async (userId: string) => {
    const confirmDeactivate = confirm('Деактивировать пользователя?')
    if (!confirmDeactivate) return

    const response = await fetch(`/api/admin/users/${userId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      }
    )

    if (response.ok) {
      await loadUsers(page)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    } else {
      const error = await response.json().catch(() => null)
      alert(error?.error ?? 'Не удалось деактивировать пользователя')
    }
  }, [loadUsers, page])

  const bulkDeactivate = useCallback(async () => {
    if (selectedIds.size === 0) return
    const confirmDeactivate = confirm('Деактивировать выбранных пользователей?')
    if (!confirmDeactivate) return

    setIsBulkUpdating(true)
    try {
      const response = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', userIds: Array.from(selectedIds) }),
      })

      if (response.ok) {
        await loadUsers(page)
        setSelectedIds(new Set())
      } else {
        const error = await response.json().catch(() => null)
        alert(error?.error ?? 'Не удалось выполнить массовое действие')
      }
    } finally {
      setIsBulkUpdating(false)
    }
  }, [selectedIds, loadUsers, page])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 w-48 rounded-full bg-[var(--muted)]/40 animate-pulse" />
          <SkeletonCard lines={3} />
          <SkeletonTable rows={6} columns={6} />
        </div>
      </DashboardLayout>
    )
  }

  if (!session || !isManager) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Пользователи</h1>
          <button
            onClick={() => loadUsers(page)}
            className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            Обновить
          </button>
        </div>

        <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Создать пользователя</h2>
          <form onSubmit={handleCreateSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Имя</label>
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                placeholder="Иван Иванов"
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                placeholder="user@callwork.ru"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Роль</label>
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as 'EMPLOYEE' | 'MANAGER' }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
              >
                <option value="EMPLOYEE">Сотрудник</option>
                <option value="MANAGER">Менеджер</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Пароль</label>
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                placeholder="Мин. 12 символов"
                required
                minLength={12}
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Заглавная буква, цифра и спецсимвол обязательны</p>
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-6">
              <button
                type="submit"
                disabled={isCreating}
                className="px-5 py-2.5 rounded-[12px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:bg-[var(--muted-foreground)]"
              >
                {isCreating ? 'Создаем...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>

        {editingUserId && (
          <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Редактировать пользователя</h2>
            <form onSubmit={handleEditSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Имя</label>
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Роль</label>
                <select
                  value={editForm.role}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value as 'EMPLOYEE' | 'MANAGER' }))}
                  className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                  disabled={isEditingSelf}
                >
                  <option value="EMPLOYEE">Сотрудник</option>
                  <option value="MANAGER">Менеджер</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Статус</label>
                <select
                  value={editForm.isActive ? 'active' : 'inactive'}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.value === 'active' }))}
                  className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                  disabled={isEditingSelf}
                >
                  <option value="active">Активен</option>
                  <option value="inactive">Неактивен</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Новый пароль</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                  placeholder="Оставьте пустым, чтобы не менять"
                  minLength={12}
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Если указано, пароль будет обновлен</p>
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2.5 rounded-[12px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:bg-[var(--muted-foreground)]"
                >
                  {isUpdating ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Список пользователей</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted-foreground)]">Выбрано: {selectedIds.size}</span>
              <button
                onClick={bulkDeactivate}
                disabled={selectedIds.size === 0 || isBulkUpdating}
                className="px-4 py-2 rounded-[10px] bg-[var(--danger)]/10 text-[var(--danger)] text-sm font-medium disabled:text-[var(--muted-foreground)] disabled:bg-[var(--muted)]"
              >
                {isBulkUpdating ? 'Выполняем...' : 'Деактивировать выбранных'}
              </button>
            </div>
          </div>

          {isLoading ? (
            <SkeletonTable rows={6} columns={6} />
          ) : users.length === 0 ? (
            <EmptyState
              title="Нет данных"
              description="Пользователи не найдены. Создайте первого сотрудника."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    <th className="py-3 px-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="py-3 px-2 text-left">Пользователь</th>
                    <th className="py-3 px-2 text-left">Роль</th>
                    <th className="py-3 px-2 text-left">Статус</th>
                    <th className="py-3 px-2 text-left">Последний вход</th>
                    <th className="py-3 px-2 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isCurrentUser = user.id === session.user.id
                    const isAdminUser = user.role === 'ADMIN'
                    return (
                      <tr key={user.id} className="border-b border-[var(--border)]">
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={() => toggleSelectUser(user.id)}
                            disabled={isCurrentUser || isAdminUser}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium text-[var(--foreground)]">{user.name}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{user.email}</div>
                        </td>
                        <td className="py-3 px-2">
                          {user.role === 'ADMIN'
                            ? 'Администратор'
                            : user.role === 'MANAGER'
                              ? 'Менеджер'
                              : 'Сотрудник'}
                        </td>
                        <td className="py-3 px-2">
                          <span className={user.isActive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                            {user.isActive ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[var(--muted-foreground)]">
                          {formatDateTime(user.lastLoginAt)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isAdminUser && (
                              <button
                                onClick={() => startEdit(user)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-xs"
                              >
                                Редактировать
                              </button>
                            )}
                            <button
                              onClick={() => deactivateUser(user.id)}
                              disabled={isCurrentUser || !user.isActive || isAdminUser}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs text-[var(--danger)] disabled:text-[var(--muted-foreground)]"
                            >
                              Деактивировать
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pagination && pagination.totalPages > 1 && !isLoading && (
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted-foreground)]">
              <button
                onClick={() => loadUsers(Math.max(1, page - 1))}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 rounded-md border border-[var(--border)] disabled:opacity-50"
              >
                Назад
              </button>
              <span>Страница {pagination.page} из {pagination.totalPages}</span>
              <button
                onClick={() => loadUsers(page + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-1 rounded-md border border-[var(--border)] disabled:opacity-50"
              >
                Вперёд
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
