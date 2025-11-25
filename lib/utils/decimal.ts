/**
 * Утилиты для работы с Decimal.js в финансовых расчётах
 *
 * ВАЖНО: Все финансовые вычисления должны использовать эти утилиты
 * для предотвращения потери точности при работе с JavaScript Number.
 *
 * Стратегия: "Decimal inside, Number outside"
 * - Внутри сервисов все расчёты через Decimal
 * - API возвращает Number для совместимости с фронтендом
 */

import DecimalJS from 'decimal.js'

// Тип для Decimal instance (для использования в сигнатурах функций)
export type Decimal = InstanceType<typeof DecimalJS>

// Конфигурация Decimal.js для финансовых вычислений
DecimalJS.config({
  precision: 20, // Достаточно для любых финансовых расчётов
  rounding: DecimalJS.ROUND_HALF_UP, // Стандартное банковское округление
})

/**
 * Безопасное преобразование любого значения в Decimal.
 *
 * Обрабатывает:
 * - Prisma Decimal (объект с toString())
 * - Number
 * - String
 * - null/undefined -> 0
 *
 * @example
 * toDecimal(user.monthlyGoal) // Prisma Decimal
 * toDecimal(123.45)           // Number
 * toDecimal("1000000.00")     // String
 * toDecimal(null)             // -> Decimal(0)
 */
export function toDecimal(value: unknown): Decimal {
  if (value === null || value === undefined) {
    return new DecimalJS(0)
  }

  if (value instanceof DecimalJS) {
    return value
  }

  // Prisma Decimal и другие объекты с toString()
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const strValue = (value as { toString: () => string }).toString()
    try {
      return new DecimalJS(strValue)
    } catch {
      return new DecimalJS(0)
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    try {
      return new DecimalJS(value)
    } catch {
      return new DecimalJS(0)
    }
  }

  return new DecimalJS(0)
}

/**
 * Сумма массива значений с использованием Decimal.
 *
 * @example
 * const total = sumDecimals(reports.map(r => r.monthlySalesAmount))
 * const teamGoal = sumDecimals(team.map(u => u.monthlyGoal))
 */
export function sumDecimals(values: unknown[]): Decimal {
  return values.reduce<Decimal>(
    (acc, val) => acc.plus(toDecimal(val)),
    new DecimalJS(0)
  )
}

/**
 * Округление денежной суммы до 2 знаков после запятой.
 * Использует ROUND_HALF_UP (банковское округление).
 *
 * @example
 * roundMoney(new Decimal(123.456)) // -> Decimal(123.46)
 * roundMoney(new Decimal(123.454)) // -> Decimal(123.45)
 */
export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, DecimalJS.ROUND_HALF_UP)
}

/**
 * Конвертация Decimal в number для API ответов.
 *
 * ВАЖНО: Использовать ТОЛЬКО для финального вывода!
 * Не использовать для промежуточных вычислений.
 *
 * @example
 * return { total: toNumber(decimalTotal) }
 */
export function toNumber(value: Decimal): number {
  return value.toNumber()
}

/**
 * Безопасное деление с защитой от деления на ноль.
 *
 * @param numerator Делимое
 * @param denominator Делитель
 * @param fallback Значение при делении на ноль (по умолчанию 0)
 *
 * @example
 * const average = safeDivide(total, new Decimal(count))
 */
export function safeDivide(
  numerator: Decimal,
  denominator: Decimal,
  fallback: Decimal = new DecimalJS(0)
): Decimal {
  if (denominator.isZero()) {
    return fallback
  }
  return numerator.dividedBy(denominator)
}

/**
 * Расчёт процента: (value / base) * 100
 *
 * @example
 * const completion = calcPercent(currentSales, goalAmount) // 75.5 (%)
 */
export function calcPercent(value: Decimal, base: Decimal): Decimal {
  if (base.isZero()) {
    return new DecimalJS(0)
  }
  return value.dividedBy(base).times(100)
}

/**
 * Округление процентов до 2 знаков и конвертация в number.
 *
 * @example
 * const percentValue = roundPercent(calcPercent(current, total)) // 75.55
 */
export function roundPercent(value: Decimal): number {
  return value.toDecimalPlaces(2, DecimalJS.ROUND_HALF_UP).toNumber()
}

/**
 * Округление числа до N знаков после запятой с использованием Decimal.
 * Более точное чем Math.round(num * 100) / 100
 *
 * @example
 * round2(0.1 + 0.2) // 0.3 (не 0.30000000000000004)
 */
export function round2(num: number): number {
  return new DecimalJS(num).toDecimalPlaces(2, DecimalJS.ROUND_HALF_UP).toNumber()
}

/**
 * Безопасный расчёт ставки/конверсии: (value / base) * 100
 * Возвращает 0 если base <= 0
 *
 * @example
 * const conversionRate = safeRate(deals, appointments) // 15.5 (%)
 */
export function safeRate(value: number, base: number): number {
  if (base <= 0) return 0
  return new DecimalJS(value)
    .dividedBy(base)
    .times(100)
    .toDecimalPlaces(2, DecimalJS.ROUND_HALF_UP)
    .toNumber()
}
