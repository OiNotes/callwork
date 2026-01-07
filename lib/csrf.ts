import { NextResponse } from 'next/server'

export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  if (!origin || !host) return false

  const originUrl = new URL(origin)
  return originUrl.host === host
}

export function csrfError() {
  return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
}
