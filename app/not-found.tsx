'use client'

import { Button } from '@/components/ui/Button'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-xl font-semibold text-foreground">
            Страница не найдена
          </h2>
          <p className="text-muted-foreground">
            Запрашиваемая страница не существует или была перемещена.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" className="gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              На главную
            </Link>
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </div>
      </div>
    </div>
  )
}
