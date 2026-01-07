import { describe, it, expect } from 'vitest'
import { buildPagination } from '@/lib/utils/pagination'

describe('buildPagination', () => {
  it('calculates total pages and flags', () => {
    const pagination = buildPagination(1, 10, 35)
    expect(pagination.totalPages).toBe(4)
    expect(pagination.hasNext).toBe(true)
    expect(pagination.hasPrev).toBe(false)
  })

  it('handles last page', () => {
    const pagination = buildPagination(4, 10, 35)
    expect(pagination.hasNext).toBe(false)
    expect(pagination.hasPrev).toBe(true)
  })
})
