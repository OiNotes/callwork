'use client'

import { useState, memo, useCallback, useMemo } from 'react'
import { motion } from '@/lib/motion'
import { Mail, Lock, ArrowRight } from 'lucide-react'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => void
  isLoading?: boolean
  errorMessage?: string | null
  onClearError?: () => void
}

export const LoginForm = memo(function LoginForm({
  onSubmit,
  isLoading = false,
  errorMessage,
  onClearError
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const emailError = useMemo(() => {
    if (!email) return 'Введите email'
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    return isValid ? '' : 'Введите корректный email'
  }, [email])

  const passwordError = useMemo(() => {
    if (!password) return 'Введите пароль'
    return ''
  }, [password])

  const showEmailError = Boolean(emailError) && (touched.email || submitAttempted)
  const showPasswordError = Boolean(passwordError) && (touched.password || submitAttempted)
  const formError = submitAttempted ? (emailError || passwordError || null) : null
  const isFormValid = !emailError && !passwordError

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isFormValid) return
    onSubmit(email, password)
  }, [email, password, onSubmit, isFormValid])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    onClearError?.()
  }, [onClearError])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    onClearError?.()
  }, [onClearError])

  const handleEmailFocus = useCallback(() => {
    setFocusedField('email')
  }, [])

  const handlePasswordFocus = useCallback(() => {
    setFocusedField('password')
  }, [])

  const handleEmailBlur = useCallback(() => {
    setFocusedField(null)
    setTouched((prev) => ({ ...prev, email: true }))
  }, [])

  const handlePasswordBlur = useCallback(() => {
    setFocusedField(null)
    setTouched((prev) => ({ ...prev, password: true }))
  }, [])

  const emailErrorId = 'login-email-error'
  const passwordErrorId = 'login-password-error'

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
            value={email}
            onChange={handleEmailChange}
            onFocus={handleEmailFocus}
            onBlur={handleEmailBlur}
            required
            aria-invalid={showEmailError || undefined}
            aria-describedby={showEmailError ? emailErrorId : undefined}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${focusedField === 'email'
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
            value={password}
            onChange={handlePasswordChange}
            onFocus={handlePasswordFocus}
            onBlur={handlePasswordBlur}
            required
            aria-invalid={showPasswordError || undefined}
            aria-describedby={showPasswordError ? passwordErrorId : undefined}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${focusedField === 'password'
                ? 'border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25'
                : 'border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            placeholder="••••••••"
          />
        </div>
        {showPasswordError && (
          <p id={passwordErrorId} className="mt-2 text-xs text-[var(--danger)]">
            {passwordError}
          </p>
        )}
      </div>

      {/* Forgot Password Link */}
      <div className="flex justify-end">
        <button
          type="button"
          className="text-sm text-[var(--primary)] hover:underline transition-all duration-200"
        >
          Забыли пароль?
        </button>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] font-medium text-[var(--primary-foreground)] transition-all duration-200 ${isLoading
            ? 'bg-[var(--muted)] cursor-not-allowed'
            : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-lg shadow-[var(--primary)]/30'
          }`}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Войти</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </motion.button>
    </form>
  )
})
