import { describe, expect, it } from 'vitest'
import { validateNumber, validateSalesAmount, isValidCode, MAX_SALES_AMOUNT } from '@/bot/utils/validation'

describe('validateNumber', () => {
  it('accepts numeric strings', () => {
    expect(validateNumber('123')).toBe(123)
  })

  it('rejects text', () => {
    expect(validateNumber('abc')).toBeNull()
  })

  it('rejects negative numbers', () => {
    expect(validateNumber('-5')).toBeNull()
  })
})

describe('validateSalesAmount', () => {
  it('accepts valid decimal', () => {
    expect(validateSalesAmount('1000')).toBe('1000')
  })

  it('rejects amounts greater than MAX', () => {
    const tooLarge = String(MAX_SALES_AMOUNT + 1)
    expect(validateSalesAmount(tooLarge)).toBeNull()
  })
})

describe('isValidCode', () => {
  it('accepts 6 digits', () => {
    expect(isValidCode('123456')).toBe(true)
  })

  it('rejects letters', () => {
    expect(isValidCode('abc123')).toBe(false)
  })
})
