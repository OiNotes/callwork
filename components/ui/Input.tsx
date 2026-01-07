'use client'

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      leftIcon,
      rightIcon,
      wrapperClassName,
      className,
      disabled,
      required,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium text-[var(--foreground)]',
              disabled && 'opacity-50'
            )}
          >
            {label}
            {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-required={required}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'flex w-full rounded-[var(--radius-md)] border bg-[var(--input)]',
              'text-[var(--foreground)] text-base min-h-[44px] px-3 py-2',
              'placeholder:text-[var(--muted-foreground)]',
              'border-[var(--border)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--muted)]',
              'transition-colors duration-200',
              error && 'border-[var(--danger)] focus:ring-[var(--danger)]',
              success && !error && 'border-[var(--success)] focus:ring-[var(--success)]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
