import { describe, it, expect } from 'vitest'
import { formatMoney, formatPercent, formatDate } from '@/lib/utils/format'

const normalizeSpaces = (value: string) => value.replace(/\s/g, ' ')

describe('formatMoney', () => {
  it('formats rubles', () => {
    const result = normalizeSpaces(formatMoney(1234567))
    expect(result).toMatch(/1 234 567/)
    expect(result).toContain('₽')
  })

  it('formats with kopeks rounding', () => {
    const result = normalizeSpaces(formatMoney('1234.56'))
    expect(result).toMatch(/1 235/)
  })

  it('handles 0', () => {
    expect(normalizeSpaces(formatMoney(0))).toMatch(/0/)
  })

  it('handles negatives', () => {
    const result = normalizeSpaces(formatMoney(-500))
    expect(result).toContain('-')
    expect(result).toContain('₽')
  })
})

describe('formatPercent', () => {
  it('formats percents with default decimals', () => {
    expect(formatPercent(85.7)).toBe('85.7%')
  })

  it('formats percents with custom decimals', () => {
    expect(formatPercent(100, 0)).toBe('100%')
  })

  it('handles null/undefined', () => {
    expect(formatPercent(null)).toBe('0%')
    expect(formatPercent(undefined)).toBe('0%')
  })
})

describe('formatDate', () => {
  it('formats date', () => {
    expect(formatDate(new Date(2025, 0, 15))).toBe('15 янв 2025')
  })

  it('handles invalid date', () => {
    expect(formatDate('invalid')).toBe('Неверная дата')
  })

  it('handles empty input', () => {
    expect(formatDate(null)).toBe('Нет даты')
    expect(formatDate(undefined)).toBe('Нет даты')
  })
})
