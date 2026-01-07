/**
 * Chart Data Utilities
 *
 * Functions for building sparkline histories from report data
 */
import { roundMoney, toDecimal, toNumber, type Decimal } from '@/lib/utils/decimal'

interface Report {
  date: string | Date
  monthlySalesAmount?: number | string
  successfulDeals?: number
  pzmConducted?: number
  vzmConducted?: number
}

interface DailyValue {
  date: string
  value: number
}

/**
 * Build KPI histories from daily reports (for PulseGrid sparklines)
 *
 * @param reports - Array of report objects
 * @param days - Number of days to include (default 30)
 * @returns Object with arrays for each KPI metric
 */
export function buildKpiHistories(
  reports: Report[],
  days: number = 30
): {
  sales: number[]
  deals: number[]
  zoom1: number[]
  zoom2: number[]
} {
  if (!reports || reports.length === 0) {
    return { sales: [], deals: [], zoom1: [], zoom2: [] }
  }

  // Group by date
  const dailyMap = new Map<string, { sales: Decimal; deals: number; zoom1: number; zoom2: number }>()

  reports.forEach((r) => {
    const dateKey = new Date(r.date).toISOString().split('T')[0]

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { sales: toDecimal(0), deals: 0, zoom1: 0, zoom2: 0 })
    }

    const entry = dailyMap.get(dateKey)!
    entry.sales = entry.sales.plus(toDecimal(r.monthlySalesAmount || 0))
    entry.deals += Number(r.successfulDeals || 0)
    entry.zoom1 += Number(r.pzmConducted || 0)
    entry.zoom2 += Number(r.vzmConducted || 0)
  })

  // Sort by date and take last N days
  const sortedEntries = Array.from(dailyMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-days)

  return {
    sales: sortedEntries.map(([, v]) => toNumber(roundMoney(v.sales))),
    deals: sortedEntries.map(([, v]) => v.deals),
    zoom1: sortedEntries.map(([, v]) => v.zoom1),
    zoom2: sortedEntries.map(([, v]) => v.zoom2),
  }
}

/**
 * Build sparkline data for each manager's activity (for ManagersTable)
 *
 * Uses successfulDeals as the metric since it's a daily count,
 * unlike monthlySalesAmount which is cumulative.
 *
 * @param employeesWithReports - Array of employee objects with reports
 * @param days - Number of days for sparkline (default 7)
 * @returns Map of managerId -> deals history array
 */
export function buildManagerSparklines(
  employeesWithReports: Array<{ id: string; reports?: Report[] }>,
  days: number = 7
): Map<string, number[]> {
  const result = new Map<string, number[]>()

  employeesWithReports.forEach((emp) => {
    if (!emp.reports || emp.reports.length === 0) {
      result.set(emp.id, [])
      return
    }

    // Group by date - use successfulDeals (daily count) for sparkline
    const dailyMap = new Map<string, number>()

    emp.reports.forEach((r) => {
      const dateKey = new Date(r.date).toISOString().split('T')[0]
      const current = dailyMap.get(dateKey) || 0
      // Use sum of activity: deals + zoom1 + zoom2 for a more meaningful sparkline
      const dailyActivity = Number(r.successfulDeals || 0) +
                           Number(r.pzmConducted || 0) +
                           Number(r.vzmConducted || 0)
      dailyMap.set(dateKey, current + dailyActivity)
    })

    // Sort and take last N days
    const sortedValues = Array.from(dailyMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-days)
      .map(([, val]) => val)

    result.set(emp.id, sortedValues)
  })

  return result
}

/**
 * Build cumulative sum array (for showing progress toward goal)
 *
 * @param values - Daily values array
 * @returns Cumulative sum array
 */
export function buildCumulativeSum(values: number[]): number[] {
  let sum = toDecimal(0)
  return values.map((v) => {
    sum = sum.plus(toDecimal(v))
    return toNumber(roundMoney(sum))
  })
}

/**
 * Calculate trend direction from sparkline data
 *
 * @param data - Array of values
 * @returns 'up' | 'down' | 'flat'
 */
export function calculateTrend(data: number[]): 'up' | 'down' | 'flat' {
  if (!data || data.length < 2) return 'flat'

  const firstHalf = data.slice(0, Math.floor(data.length / 2))
  const secondHalf = data.slice(Math.floor(data.length / 2))

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  const changePercent = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0

  if (changePercent > 10) return 'up'
  if (changePercent < -10) return 'down'
  return 'flat'
}

/**
 * Fill missing dates in sparkline with zeros
 *
 * @param data - Array of {date, value} objects
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Complete array with all dates filled
 */
export function fillMissingDates(
  data: DailyValue[],
  startDate: Date,
  endDate: Date
): DailyValue[] {
  const dataMap = new Map(data.map((d) => [d.date, d.value]))
  const result: DailyValue[] = []

  const current = new Date(startDate)
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0]
    result.push({
      date: dateKey,
      value: dataMap.get(dateKey) || 0,
    })
    current.setDate(current.getDate() + 1)
  }

  return result
}
