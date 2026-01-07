'use client'

import { useState, memo, useCallback, useMemo } from 'react'
import { motion } from '@/lib/motion'
import { Mail, Lock, User, ArrowRight } from 'lucide-react'

interface RegisterFormProps {
  onSubmit: (data: { email: string; password: string; name: string }) => void
  isLoading?: boolean
  errorMessage?: string | null
  onClearError?: () => void
}

export const RegisterForm = memo(function RegisterForm({
  onSubmit,
  isLoading = false,
  errorMessage,
  onClearError
}: RegisterFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [touched, setTouched] = useState({ name: false, email: false, password: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const passwordChecks = useMemo(() => {
    const password = formData.password
    return {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }
  }, [formData.password])

  const passwordScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length
  }, [passwordChecks])

  const passwordStrength = useMemo(() => {
    if (passwordScore >= 4) return { label: 'Сильный', color: 'bg-[var(--success)]' }
    if (passwordScore >= 2) return { label: 'Средний', color: 'bg-[var(--warning)]' }
    return { label: 'Слабый', color: 'bg-[var(--danger)]' }
  }, [passwordScore])

  const isPasswordStrongEnough = passwordScore >= 2

  const nameError = useMemo(() => {
    if (!formData.name) return 'Введите имя'
    if (formData.name.trim().length < 2) return 'Имя должно быть не короче 2 символов'
    return ''
  }, [formData.name])

  const emailError = useMemo(() => {
    if (!formData.email) return 'Введите email'
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    return isValid ? '' : 'Введите корректный email'
  }, [formData.email])

  const passwordError = useMemo(() => {
    if (!formData.password) return 'Введите пароль'
    if (!isPasswordStrongEnough) return 'Пароль слишком слабый'
    return ''
  }, [formData.password, isPasswordStrongEnough])

  const showNameError = Boolean(nameError) && (touched.name || submitAttempted)
  const showEmailError = Boolean(emailError) && (touched.email || submitAttempted)
  const showPasswordError = Boolean(passwordError) && (touched.password || submitAttempted)
  const formError = submitAttempted ? (nameError || emailError || passwordError || null) : null
  const isFormValid = !nameError && !emailError && !passwordError

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isFormValid) return
    onSubmit(formData)
  }, [formData, onSubmit, isFormValid])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }))
    onClearError?.()
  }, [onClearError])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value }))
    onClearError?.()
  }, [onClearError])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, password: e.target.value }))
    onClearError?.()
  }, [onClearError])

  const handleNameFocus = useCallback(() => {
    setFocusedField('name')
  }, [])

  const handleEmailFocus = useCallback(() => {
    setFocusedField('email')
  }, [])

  const handlePasswordFocus = useCallback(() => {
    setFocusedField('password')
  }, [])

  const handleNameBlur = useCallback(() => {
    setFocusedField(null)
    setTouched((prev) => ({ ...prev, name: true }))
  }, [])

  const handleEmailBlur = useCallback(() => {
    setFocusedField(null)
    setTouched((prev) => ({ ...prev, email: true }))
  }, [])

  const handlePasswordBlur = useCallback(() => {
    setFocusedField(null)
    setTouched((prev) => ({ ...prev, password: true }))
  }, [])

  const nameErrorId = 'register-name-error'
  const emailErrorId = 'register-email-error'
  const passwordErrorId = 'register-password-error'

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-5"
    >
      {(errorMessage || formError) && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]"
        >
          {errorMessage ?? formError}
        </div>
      )}

      {/* Name Field */}
      <div className="relative">
        <label htmlFor="name" className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Имя
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            <User className="w-5 h-5" />
          </div>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={handleNameChange}
            onFocus={handleNameFocus}
            onBlur={handleNameBlur}
            required
            minLength={2}
            aria-invalid={showNameError || undefined}
            aria-describedby={showNameError ? nameErrorId : undefined}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${
              focusedField === 'name'
                ? 'border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25'
                : 'border-[var(--border)] hover:border-[var(--primary)]'
            }`}
            placeholder="Иван Иванов"
          />
        </div>
        {showNameError && (
          <p id={nameErrorId} className="mt-2 text-xs text-[var(--danger)]">
            {nameError}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div className="relative">
        <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Email
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            <Mail className="w-5 h-5" />
          </div>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={handleEmailChange}
            onFocus={handleEmailFocus}
            onBlur={handleEmailBlur}
            required
            aria-invalid={showEmailError || undefined}
            aria-describedby={showEmailError ? emailErrorId : undefined}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${
              focusedField === 'email'
                ? 'border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25'
                : 'border-[var(--border)] hover:border-[var(--primary)]'
            }`}
            placeholder="your@email.com"
          />
        </div>
        {showEmailError && (
          <p id={emailErrorId} className="mt-2 text-xs text-[var(--danger)]">
            {emailError}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="relative">
        <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Пароль
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={handlePasswordChange}
            onFocus={handlePasswordFocus}
            onBlur={handlePasswordBlur}
            required
            minLength={12}
            aria-invalid={showPasswordError || undefined}
            aria-describedby={showPasswordError ? passwordErrorId : undefined}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${
              focusedField === 'password'
                ? 'border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25'
                : 'border-[var(--border)] hover:border-[var(--primary)]'
            }`}
            placeholder="Минимум 12 символов"
          />
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Надежность пароля</span>
            <span className={passwordScore >= 2 ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}>
              {passwordStrength.label}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--muted)]/40 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${passwordStrength.color}`}
              style={{ width: `${(passwordScore / 4) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className={passwordChecks.length ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}>
              12+ символов
            </span>
            <span className={passwordChecks.uppercase ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}>
              Заглавная буква
            </span>
            <span className={passwordChecks.number ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}>
              Цифра
            </span>
            <span className={passwordChecks.special ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}>
              Спецсимвол
            </span>
          </div>
          {showPasswordError && (
            <p id={passwordErrorId} className="text-xs text-[var(--danger)]">
              {passwordError}
            </p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading || !isFormValid}
        aria-disabled={isLoading || !isFormValid}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] font-medium text-[var(--primary-foreground)] transition-all duration-200 ${
          isLoading || !isFormValid
            ? 'bg-[var(--muted)] cursor-not-allowed'
            : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-[var(--shadow-sm)]'
        }`}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Зарегистрироваться</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </motion.button>
    </form>
  )
})
