/**
 * Расчёт прогноза выполнения месячного плана продаж
 * 
 * @param currentSales - Текущая сумма продаж за текущий месяц
 * @param monthlyGoal - Месячная цель продаж
 * @returns Объект с метриками прогноза
 */
import { roundMoney, toDecimal, toNumber, type Decimal } from '@/lib/utils/decimal'

const roundInt = (value: Decimal): number => value.toDecimalPlaces(0).toNumber()

export function calculateMonthlyForecast(
  currentSales: number,
  monthlyGoal: number
) {
  const sales = toDecimal(currentSales)
  const goal = toDecimal(monthlyGoal)
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  
  // Дней в текущем месяце
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  // Сколько дней прошло (включая текущий)
  const daysPassed = today.getDate()
  
  // Сколько дней осталось
  const daysRemaining = daysInMonth - daysPassed
  
  // Средняя сумма продаж в день
  const dailyAverage = daysPassed > 0 ? sales.dividedBy(daysPassed) : toDecimal(0)
  
  // Прогноз на конец месяца (линейная экстраполяция)
  const projectedTotal = dailyAverage.times(daysInMonth)
  
  // Процент выполнения прогноза от цели
  const projectedCompletion = goal.greaterThan(0) 
    ? projectedTotal.dividedBy(goal).times(100)
    : toDecimal(0)
  
  // Ожидаемая сумма на текущий день (по плану)
  const expectedByNow = goal.dividedBy(daysInMonth).times(daysPassed)
  
  // Темп выполнения (pacing) - насколько опережаем/отстаём от плана
  const pacing = expectedByNow.greaterThan(0) 
    ? sales.minus(expectedByNow).dividedBy(expectedByNow).times(100)
    : toDecimal(0)
  
  // Хороший ли темп? (допуск -5%)
  const isPacingGood = pacing.greaterThanOrEqualTo(-5)
  
  // Необходимая дневная сумма для достижения цели
  const dailyRequired = daysRemaining > 0 
    ? goal.minus(sales).dividedBy(daysRemaining)
    : toDecimal(0)

  return {
    // Текущие значения
    current: toNumber(roundMoney(sales)),
    goal: toNumber(roundMoney(goal)),
    
    // Прогноз
    projected: roundInt(projectedTotal),
    completion: roundInt(projectedCompletion),
    
    // Темп
    pacing: roundInt(pacing),
    isPacingGood,
    
    // Расчётные показатели
    daysInMonth,
    daysPassed,
    daysRemaining,
    dailyAverage: roundInt(dailyAverage),
    dailyRequired: roundInt(dailyRequired),
    expectedByNow: roundInt(expectedByNow),
  }
}

/**
 * Генерация данных для графика прогноза
 * 
 * @param currentSales - Текущая сумма продаж
 * @param monthlyGoal - Месячная цель
 * @param dailySales - Массив продаж по дням (опционально)
 * @returns Массив точек для графика
 */
export function generateForecastChartData(
  currentSales: number,
  monthlyGoal: number,
  dailySales?: Array<{ day: number; sales: number }>
) {
  const sales = toDecimal(currentSales)
  const goal = toDecimal(monthlyGoal)
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const currentDay = today.getDate()
  
  interface ChartPoint {
    day: number
    plan: number
    actual?: number
    forecast?: number
  }

  const data: ChartPoint[] = []

  // Расчёт среднего дневного значения
  const dailyAverage = currentDay > 0 ? sales.dividedBy(currentDay) : toDecimal(0)
  const dailyPlan = goal.dividedBy(daysInMonth)

  let cumulativeSales = toDecimal(0)

  for (let day = 1; day <= daysInMonth; day++) {
    const point: ChartPoint = {
      day,
      plan: roundInt(dailyPlan.times(day)), // Линия плана
    }

    if (day <= currentDay) {
      // Факт (используем реальные данные если есть, иначе равномерное распределение)
      if (dailySales && dailySales.length > 0) {
        const dayData = dailySales.find(d => d.day === day)
        cumulativeSales = cumulativeSales.plus(toDecimal(dayData?.sales ?? 0))
        point.actual = roundInt(cumulativeSales)
      } else {
        // Равномерное распределение
        cumulativeSales = dailyAverage.times(day)
        point.actual = roundInt(cumulativeSales)
      }
    } else {
      // Прогноз (продолжаем линию тренда)
      point.forecast = roundInt(sales.plus(dailyAverage.times(day - currentDay)))
    }

    data.push(point)
  }

  return data
}
