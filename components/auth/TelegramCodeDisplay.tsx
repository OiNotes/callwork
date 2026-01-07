'use client'

import { Copy, Check, Clock } from 'lucide-react'
import { useState, useEffect, memo, useCallback } from 'react'

interface TelegramCodeDisplayProps {
  code: string
  expiresAt?: Date
}

export const TelegramCodeDisplay = memo(function TelegramCodeDisplay({ code, expiresAt }: TelegramCodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    if (!expiresAt) return

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const expiry = new Date(expiresAt).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setTimeLeft('Истёк')
        clearInterval(interval)
      } else {
        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] rounded-[16px] p-8 text-[var(--primary-foreground)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <div className="text-center space-y-6">
        {/* Title */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Код для привязки Telegram
          </h3>
          <p className="text-sm opacity-80">
            Используйте этот код в боте
          </p>
        </div>

        {/* Code Display */}
        <button
          type="button"
          onClick={handleCopy}
          onKeyDown={(event) => event.key === 'Enter' && handleCopy()}
          aria-label="Скопировать код привязки"
          className="bg-[var(--primary-foreground)]/10 backdrop-blur-sm rounded-[12px] p-6 w-full transition-transform duration-200 hover:scale-102 active:scale-98"
        >
          <div className="text-5xl font-bold tracking-wider mb-3">
            {code}
          </div>
          
          <span className="inline-flex items-center gap-2 text-sm font-medium opacity-90 hover:opacity-100 transition-all duration-200 active:scale-95">
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Нажмите чтобы скопировать</span>
              </>
            )}
          </span>
        </button>

        {/* Timer */}
        {timeLeft && (
          <div className="flex items-center justify-center gap-2 text-sm opacity-80">
            <Clock className="w-4 h-4" />
            <span>Действителен: {timeLeft}</span>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[var(--primary-foreground)]/5 rounded-[12px] p-4 text-left">
          <p className="text-sm opacity-90 font-medium mb-3">
            Как использовать:
          </p>
          <ol className="space-y-2 text-sm opacity-80">
            <li className="flex gap-2">
              <span className="font-semibold">1.</span>
              <span>Откройте бота @CallworkBot в Telegram</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">2.</span>
              <span>Отправьте команду /register</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">3.</span>
              <span>Введите этот код</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
})
