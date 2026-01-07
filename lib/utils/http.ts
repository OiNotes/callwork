import { NextResponse } from 'next/server'

export function jsonWithPrivateCache<T>(
  data: T,
  init?: ResponseInit,
  ttlSeconds = 30
) {
  const response = NextResponse.json(data, init)
  response.headers.set(
    'Cache-Control',
    `private, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`
  )
  return response
}
