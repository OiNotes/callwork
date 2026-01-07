/**
 * Безопасные функции форматирования для дат и денег
 *
 * Используются в компонентах дашборда для предотвращения ошибок с типами
 */
import { logWarning } from '@/lib/logger'
import { roundMoney, toDecimal, toNumber } from '@/lib/utils/decimal'

/**
 * Форматирует дату в формат "DD месяц YYYY"
 *
 * @param dateInput - Date объект, ISO строка, или null/undefined
 * @returns Отформатированная дата или fallback строка
 *
 * @example
 * formatDate('2025-01-15T00:00:00.000Z') // "15 янв 2025"
 * formatDate(new Date()) // "18 ноя 2025"
 * formatDate(null) // "Нет даты"
 */
export function formatDate(dateInput: Date | string | null | undefined): string {
  // Проверка на null/undefined
  if (!dateInput) {
    return 'Нет даты'
  }

  // Конверсия строки в Date объект
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

  // Валидация даты
  if (isNaN(date.getTime())) {
    logWarning('Invalid date provided to formatDate', { dateInput })
    return 'Неверная дата'
  }

  // Fallback-first: ручное форматирование (более надёжно для SSR)
  const day = String(date.getDate()).padStart(2, '0')
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  const month = months[date.getMonth()]
  const year = date.getFullYear()

  return `${day} ${month} ${year}`
}

/**
 * Форматирует дату в короткий формат "DD месяц"
 *
 * @param dateInput - Date объект, ISO строка, или null/undefined
 * @returns Отформатированная дата или fallback строка
 *
 * @example
 * formatDateShort('2025-01-15T00:00:00.000Z') // "15 янв"
 */
export function formatDateShort(dateInput: Date | string | null | undefined): string {
  if (!dateInput) {
    return 'Нет даты'
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

  if (isNaN(date.getTime())) {
    return 'Неверная дата'
  }

  // Fallback-first: ручное форматирование
  const day = String(date.getDate()).padStart(2, '0')
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  const month = months[date.getMonth()]

  return `${day} ${month}`
}

/**
 * Форматирует сумму денег в рубли
 *
 * @param amount - Сумма (number, string, Decimal) или null/undefined
 * @returns Отформатированная сумма с символом валюты
 *
 * @example
 * formatMoney(5000) // "5 000 ₽"
 * formatMoney("12345.67") // "12 346 ₽"
 * formatMoney(null) // "0 ₽"
 */
export function formatMoney(amount: number | string | null | undefined): string {
  // Проверка на null/undefined
  if (amount === null || amount === undefined) {
    return '0 ₽'
  }

  // Форматирование через Intl.NumberFormat
  try {
    const numAmount = toNumber(roundMoney(toDecimal(amount)))
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(numAmount)
  } catch {
    // Fallback на ручное форматирование
    const formatted = toNumber(roundMoney(toDecimal(amount))).toLocaleString('ru-RU')
    return `${formatted} ₽`
  }
}

/**
 * Форматирует число с разделителями тысяч
 *
 * @param num - Число или строка
 * @returns Отформатированное число
 *
 * @example
 * formatNumber(12345) // "12 345"
 * formatNumber("6789") // "6 789"
 */
export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) {
    return '0'
  }

  try {
    const numValue = toNumber(toDecimal(num).toDecimalPlaces(0))
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0,
    }).format(numValue)
  } catch {
    return toNumber(toDecimal(num).toDecimalPlaces(0)).toLocaleString('ru-RU')
  }
}

/**
 * Форматирует процент
 *
 * @param value - Процент (0-100)
 * @param decimals - Количество знаков после запятой (по умолчанию 1)
 * @returns Отформатированный процент с символом %
 *
 * @example
 * formatPercent(85.7) // "85.7%"
 * formatPercent(100, 0) // "100%"
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%'
  }

  return `${value.toFixed(decimals)}%`
}
