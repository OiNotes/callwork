type LogContext = Record<string, unknown>

export function logError(error: Error, context?: LogContext): void
export function logError(error: unknown, context?: LogContext): void
export function logError(message: string, error?: unknown, context?: LogContext): void
export function logError(
  messageOrError: string | Error | unknown,
  errorOrContext?: unknown,
  maybeContext?: LogContext
) {
  if (messageOrError instanceof Error) {
    console.error('[ERROR]', messageOrError.message, errorOrContext as LogContext | undefined)
    return
  }

  if (typeof messageOrError !== 'string') {
    const error = messageOrError instanceof Error ? messageOrError : new Error('Unknown error')
    const context =
      errorOrContext && typeof errorOrContext === 'object'
        ? (errorOrContext as LogContext)
        : undefined
    console.error('[ERROR]', error.message, { original: messageOrError, ...context })
    return
  }

  const message = messageOrError
  const error = errorOrContext instanceof Error ? errorOrContext : new Error(message)
  const context =
    errorOrContext instanceof Error
      ? maybeContext
      : (errorOrContext as LogContext | undefined)

  const mergedContext = context ? { message, ...context } : { message }
  console.error('[ERROR]', error.message, mergedContext)

  // In production:
  // Sentry.captureException(error, { extra: mergedContext })
}

export function logWarning(message: string, context?: LogContext) {
  console.warn('[WARN]', message, context)
}
