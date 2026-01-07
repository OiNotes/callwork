'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TelegramCodeDisplay } from '@/components/auth/TelegramCodeDisplay'
import { SkeletonCard } from '@/components/ui/SkeletonCard'

type ProfileData = {
  id: string
  name: string
  email: string
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
  telegramId: string | null
  lastLoginAt: string | null
}

type SessionInfo = {
  id: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string | null
  ipAddress: string | null
  userAgent: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [telegramCode, setTelegramCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isSessionsLoading, setIsSessionsLoading] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

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

  const sessionsAvailable = useMemo(() => sessions.length > 0, [sessions.length])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  const loadProfile = useCallback(async () => {
    const response = await fetch('/api/profile')
    if (response.ok) {
      const data = await response.json()
      setProfile(data.user)
      setProfileForm({
        name: data.user.name ?? '',
        email: data.user.email ?? '',
      })
    }
  }, [])

  const loadSessions = useCallback(async () => {
    setIsSessionsLoading(true)
    try {
      const response = await fetch('/api/auth/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions ?? [])
        setCurrentSessionId(data.currentSessionId ?? null)
      }
    } finally {
      setIsSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile()
      loadSessions()
    }
  }, [status, loadProfile, loadSessions])

  const handleProfileSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSavingProfile(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        setProfileForm({ name: data.user.name ?? '', email: data.user.email ?? '' })
        await update({ name: data.user.name, email: data.user.email })
      } else {
        const error = await response.json().catch(() => null)
        alert(error?.error ?? 'Не удалось обновить профиль')
      }
    } finally {
      setIsSavingProfile(false)
    }
  }, [profileForm, update])

  const resetProfileForm = useCallback(() => {
    setProfileForm({
      name: profile?.name ?? '',
      email: profile?.email ?? '',
    })
  }, [profile?.email, profile?.name])

  const handlePasswordSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Пароли не совпадают')
      return
    }
    setIsSavingPassword(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      if (response.ok) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        alert('Пароль обновлен')
      } else {
        const error = await response.json().catch(() => null)
        alert(error?.error ?? 'Не удалось обновить пароль')
      }
    } finally {
      setIsSavingPassword(false)
    }
  }, [passwordForm])

  const resetPasswordForm = useCallback(() => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }, [])

  const generateTelegramCode = useCallback(async () => {
    setIsGeneratingCode(true)
    try {
      const response = await fetch('/api/telegram/generate-code', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setTelegramCode({ code: data.code, expiresAt: data.expiresAt })
      } else {
        alert('Не удалось сгенерировать код')
      }
    } finally {
      setIsGeneratingCode(false)
    }
  }, [])

  const unlinkTelegram = useCallback(async () => {
    const confirmUnlink = confirm('Отвязать Telegram от аккаунта?')
    if (!confirmUnlink) return

    setIsUnlinkingTelegram(true)
    try {
      const response = await fetch('/api/telegram/unlink', { method: 'POST' })
      if (response.ok) {
        setProfile((prev) => (prev ? { ...prev, telegramId: null } : prev))
        setTelegramCode(null)
      } else {
        alert('Не удалось отвязать Telegram')
      }
    } finally {
      setIsUnlinkingTelegram(false)
    }
  }, [])

  const revokeSession = useCallback(async (sessionId: string) => {
    setRevokingSessionId(sessionId)
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (response.ok) {
        await loadSessions()
      } else {
        alert('Не удалось отозвать сессию')
      }
    } finally {
      setRevokingSessionId(null)
    }
  }, [loadSessions])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="max-w-3xl space-y-6">
          <div className="h-6 w-32 rounded-full bg-[var(--muted)]/40 animate-pulse" />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </DashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Link>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Профиль</h1>

        <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Личная информация</h2>
          <form onSubmit={handleProfileSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Имя</label>
              <input
                value={profileForm.name}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Роль</label>
              <div className="px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--muted)] text-sm">
                {profile?.role === 'ADMIN'
                  ? 'Администратор'
                  : profile?.role === 'MANAGER'
                    ? 'Менеджер'
                    : 'Сотрудник'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Последний вход</label>
              <div className="px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--muted)] text-sm">
                {formatDateTime(profile?.lastLoginAt ?? null)}
              </div>
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={resetProfileForm}
                className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2.5 rounded-[12px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:bg-[var(--muted-foreground)]"
              >
                {isSavingProfile ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Смена пароля</h2>
          <form onSubmit={handlePasswordSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Текущий пароль</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Новый пароль</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                required
                minLength={12}
                placeholder="Мин. 12 символов"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">Подтвердите пароль</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                className="w-full px-4 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
                required
                minLength={12}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={resetPasswordForm}
                className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="px-5 py-2.5 rounded-[12px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:bg-[var(--muted-foreground)]"
              >
                {isSavingPassword ? 'Сохраняем...' : 'Обновить пароль'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Telegram</h2>
            {profile?.telegramId && (
              <button
                onClick={unlinkTelegram}
                disabled={isUnlinkingTelegram}
                className="px-4 py-2 rounded-[10px] text-sm text-[var(--danger)] border border-[var(--danger)]/20 disabled:text-[var(--muted-foreground)]"
              >
                {isUnlinkingTelegram ? 'Отвязываем...' : 'Отвязать'}
              </button>
            )}
          </div>

          {profile?.telegramId ? (
            <div className="text-sm text-[var(--muted-foreground)]">
              Telegram привязан. ID: <span className="text-[var(--foreground)]">{profile.telegramId}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted-foreground)]">Привяжите Telegram, чтобы сдавать отчеты через бота.</p>
              {!telegramCode ? (
                <button
                  onClick={generateTelegramCode}
                  disabled={isGeneratingCode}
                  className="px-5 py-2.5 rounded-[12px] bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:bg-[var(--muted-foreground)]"
                >
                  {isGeneratingCode ? 'Генерируем...' : 'Сгенерировать код'}
                </button>
              ) : (
                <TelegramCodeDisplay
                  code={telegramCode.code}
                  expiresAt={telegramCode.expiresAt ? new Date(telegramCode.expiresAt) : undefined}
                />
              )}
            </div>
          )}
        </div>

        <div className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Активные сессии</h2>
            <button
              onClick={loadSessions}
              className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
            >
              Обновить
            </button>
          </div>
          {isSessionsLoading ? (
            <div className="text-sm text-[var(--muted-foreground)]">Загрузка...</div>
          ) : !sessionsAvailable ? (
            <div className="text-sm text-[var(--muted-foreground)]">Нет активных сессий</div>
          ) : (
            <div className="space-y-3">
              {sessions.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 rounded-[12px] border px-4 py-3 ${
                    item.id === currentSessionId
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {item.userAgent ?? 'Неизвестное устройство'}
                    </div>
                    {item.id === currentSessionId ? (
                      <span className="text-xs text-[var(--primary)] font-medium">Текущая</span>
                    ) : (
                      <button
                        onClick={() => revokeSession(item.id)}
                        disabled={revokingSessionId === item.id}
                        className="text-xs text-[var(--danger)] disabled:text-[var(--muted-foreground)]"
                      >
                        {revokingSessionId === item.id ? 'Отзываем...' : 'Отозвать'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                    <span>IP: {item.ipAddress ?? 'Неизвестно'}</span>
                    <span>Последняя активность: {formatDateTime(item.lastSeenAt)}</span>
                    {item.expiresAt && (
                      <span>Истекает: {formatDateTime(item.expiresAt)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
