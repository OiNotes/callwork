import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import {
  toDecimal,
  sumDecimals,
  roundMoney,
  toNumber,
  safeDivide,
  calcPercent,
  roundPercent,
  round2,
  safeRate
} from '../decimal'

describe('toDecimal', () => {
  it('converts null to Decimal(0)', () => {
    expect(toDecimal(null).toNumber()).toBe(0)
  })

  it('converts undefined to Decimal(0)', () => {
    expect(toDecimal(undefined).toNumber()).toBe(0)
  })

  it('converts Number to Decimal', () => {
    expect(toDecimal(123.45).toNumber()).toBe(123.45)
  })

  it('converts String to Decimal', () => {
    expect(toDecimal('1000.50').toNumber()).toBe(1000.50)
  })

  it('returns same Decimal if already Decimal', () => {
    const d = new Decimal(100)
    expect(toDecimal(d)).toBe(d)
  })

  it('converts Prisma-like Decimal object with toString()', () => {
    const prismaDecimal = { toString: () => '999.99' }
    expect(toDecimal(prismaDecimal).toNumber()).toBe(999.99)
  })

  it('handles invalid string gracefully', () => {
    expect(toDecimal('invalid').toNumber()).toBe(0)
  })

  it('handles object without toString gracefully', () => {
    expect(toDecimal({}).toNumber()).toBe(0)
  })
})

describe('sumDecimals', () => {
  it('returns 0 for empty array', () => {
    expect(sumDecimals([]).toNumber()).toBe(0)
  })

  it('sums array of numbers', () => {
    expect(sumDecimals([10, 20, 30]).toNumber()).toBe(60)
  })

  it('sums array of Prisma Decimals', () => {
    const values = [
      { toString: () => '100.50' },
      { toString: () => '200.25' },
      { toString: () => '300.25' }
    ]
    expect(sumDecimals(values).toNumber()).toBe(601)
  })

  it('handles mixed types', () => {
    const values = [100, '50.50', null, { toString: () => '49.50' }]
    expect(sumDecimals(values).toNumber()).toBe(200)
  })
})

describe('roundMoney', () => {
  it('rounds up at .5', () => {
    expect(roundMoney(new Decimal(123.455)).toNumber()).toBe(123.46)
  })

  it('rounds down below .5', () => {
    expect(roundMoney(new Decimal(123.454)).toNumber()).toBe(123.45)
  })

  it('keeps 2 decimal places', () => {
    expect(roundMoney(new Decimal(100)).toString()).toBe('100')
  })
})

describe('toNumber', () => {
  it('converts Decimal to Number', () => {
    expect(toNumber(new Decimal(123.45))).toBe(123.45)
  })
})

describe('safeDivide', () => {
  it('divides normally when denominator > 0', () => {
    expect(safeDivide(new Decimal(100), new Decimal(4)).toNumber()).toBe(25)
  })

  it('returns fallback (0) when dividing by zero', () => {
    expect(safeDivide(new Decimal(100), new Decimal(0)).toNumber()).toBe(0)
  })

  it('returns custom fallback when dividing by zero', () => {
    expect(safeDivide(new Decimal(100), new Decimal(0), new Decimal(-1)).toNumber()).toBe(-1)
  })
})

describe('calcPercent', () => {
  it('calculates percentage correctly', () => {
    expect(calcPercent(new Decimal(25), new Decimal(100)).toNumber()).toBe(25)
  })

  it('returns 0 when base is zero', () => {
    expect(calcPercent(new Decimal(100), new Decimal(0)).toNumber()).toBe(0)
  })

  it('handles percentages > 100', () => {
    expect(calcPercent(new Decimal(150), new Decimal(100)).toNumber()).toBe(150)
  })
})

describe('roundPercent', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundPercent(new Decimal(33.3333))).toBe(33.33)
  })

  it('rounds up at .5', () => {
    expect(roundPercent(new Decimal(33.335))).toBe(33.34)
  })
})

describe('round2', () => {
  it('fixes floating point precision issues', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it('rounds to 2 decimal places', () => {
    expect(round2(123.456)).toBe(123.46)
  })

  it('rounds down correctly', () => {
    expect(round2(123.454)).toBe(123.45)
  })
})

describe('safeRate', () => {
  it('calculates rate correctly', () => {
    expect(safeRate(15, 100)).toBe(15)
  })

  it('returns 0 when base is 0', () => {
    expect(safeRate(100, 0)).toBe(0)
  })

  it('returns 0 when base is negative', () => {
    expect(safeRate(100, -5)).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    expect(safeRate(1, 3)).toBe(33.33)
  })
})
