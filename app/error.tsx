'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { logError } from '@/lib/logger'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    // In production, this should send to Sentry or similar service
    logError('Global error', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Что-то пошло не так
          </h1>
          <p className="text-muted-foreground">
            Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернуться на главную.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-left">
            <p className="text-sm font-mono text-destructive break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="primary" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Попробовать снова
          </Button>
          <Button variant="secondary" className="gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              На главную
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Если проблема повторяется, обратитесь к администратору
        </p>
      </div>
    </div>
  )
}
