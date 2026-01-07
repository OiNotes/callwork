import { roundMoney, toDecimal } from '../../lib/utils/decimal'

export const MAX_COUNT = 10000
export const MAX_SALES_AMOUNT = 1_000_000_000
export const MAX_REASON_LENGTH = 500

export function validateNumber(text: string, max: number = MAX_COUNT): number | null {
  const cleaned = text.trim().replace(/\s/g, '')
  const num = Number(cleaned)
  
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > max) {
    return null
  }
  
  return num
}

export function validateSalesAmount(text: string): string | null {
  // Удаляем пробелы, символы валюты
  const cleaned = text
    .trim()
    .replace(/\s/g, '')
    .replace(/₽/g, '')
    .replace(/руб/gi, '')
    .replace(/,/g, '.')
  
  const amount = toDecimal(cleaned)
  if (!amount.isFinite() || amount.isNegative() || amount.greaterThan(MAX_SALES_AMOUNT)) {
    return null
  }

  return roundMoney(amount).toString()
}

export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim())
}
