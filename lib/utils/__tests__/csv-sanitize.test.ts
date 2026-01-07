import { describe, it, expect } from 'vitest'
import { sanitizeForCsv, sanitizeRowForExport } from '@/lib/utils/csv-sanitize'

describe('sanitizeForCsv', () => {
  it('escapes = formulas', () => {
    expect(sanitizeForCsv('=SUM(A1)')).toBe("'=SUM(A1)")
  })

  it('escapes + formulas', () => {
    expect(sanitizeForCsv('+1234')).toBe("'+1234")
  })

  it('escapes - formulas', () => {
    expect(sanitizeForCsv('-1+2')).toBe("'-1+2")
  })

  it('escapes @ formulas', () => {
    expect(sanitizeForCsv('@cmd')).toBe("'@cmd")
  })

  it('escapes tab and carriage return prefixes', () => {
    expect(sanitizeForCsv('\tSUM(A1)')).toBe("'\tSUM(A1)")
    expect(sanitizeForCsv('\rSUM(A1)')).toBe("'\rSUM(A1)")
  })

  it('does not change safe values', () => {
    expect(sanitizeForCsv('Hello')).toBe('Hello')
  })

  it('handles null/undefined', () => {
    expect(sanitizeForCsv(null)).toBe('')
    expect(sanitizeForCsv(undefined)).toBe('')
  })
})

describe('sanitizeRowForExport', () => {
  it('sanitizes all values in row', () => {
    const result = sanitizeRowForExport({
      name: '=EVAL()',
      count: 10,
      note: 'ok',
    })

    expect(result).toEqual({
      name: "'=EVAL()",
      count: '10',
      note: 'ok',
    })
  })
})
