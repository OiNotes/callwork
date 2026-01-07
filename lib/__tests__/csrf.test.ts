import { describe, it, expect } from 'vitest'
import { validateOrigin } from '@/lib/csrf'

describe('validateOrigin', () => {
  it('allows matching origin and host', () => {
    const request = new Request('https://example.com/api', {
      headers: { origin: 'https://example.com', host: 'example.com' },
    })
    expect(validateOrigin(request)).toBe(true)
  })

  it('blocks mismatched origin', () => {
    const request = new Request('https://example.com/api', {
      headers: { origin: 'https://evil.com', host: 'example.com' },
    })
    expect(validateOrigin(request)).toBe(false)
  })

  it('blocks missing origin', () => {
    const request = new Request('https://example.com/api', {
      headers: { host: 'example.com' },
    })
    expect(validateOrigin(request)).toBe(false)
  })
})
