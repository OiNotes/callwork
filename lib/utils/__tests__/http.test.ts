import { describe, it, expect } from 'vitest'
import { jsonWithPrivateCache } from '@/lib/utils/http'

describe('jsonWithPrivateCache', () => {
  it('adds Cache-Control header', async () => {
    const response = jsonWithPrivateCache({ ok: true })
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=30')
    const data = await response.json()
    expect(data).toEqual({ ok: true })
  })

  it('uses custom TTL', () => {
    const response = jsonWithPrivateCache({ ok: true }, undefined, 120)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=120, stale-while-revalidate=120')
  })
})
