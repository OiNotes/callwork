'use client'

import { memo, useMemo, useCallback } from 'react'
import { formatMoney } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { CONVERSION_BENCHMARKS } from '@/lib/config/metrics'
import type { ConversionBenchmarkConfig } from '@/lib/services/RopSettingsService'
import type { DashboardEmployee } from '@/hooks/useDashboardData'
import { toDecimal } from '@/lib/utils/decimal'

interface ManagersTableProps {
  employees: DashboardEmployee[]
  selectedId?: string
  onSelectEmployee?: (id: string) => void
  benchmarks?: Partial<ConversionBenchmarkConfig>
  error?: string | null
  onRetry?: () => void
}

interface ManagerRowProps {
  employee: DashboardEmployee
  rank: number
  maxRevenue: number
  benchmarks: ConversionBenchmarkConfig
  isSelected: boolean
  onSelect?: (id: string) => void
}

const getCellClass = (val: number, benchmark: number) => {
  const ratio = val / (benchmark || 1)

  if (ratio >= 1.1) {
    return 'bg-[var(--success)]/10 text-[var(--success)] font-medium'
  }
  if (ratio >= 0.9) {
    return 'text-[var(--muted-foreground)]'
  }
  if (ratio >= 0.7) {
    return 'bg-[var(--warning)]/10 text-[var(--warning)]'
  }
  return 'bg-[var(--danger)]/10 text-[var(--danger)] font-medium'
}

const getRevenueColor = (salesAmount: number, planSales: number) => {
  if (planSales <= 0) return 'var(--muted-foreground)'
  const ratio = toDecimal(salesAmount).dividedBy(planSales).toNumber()
  if (ratio >= 0.8) return 'var(--primary)'
  if (ratio >= 0.5) return 'var(--warning)'
  return 'var(--danger)'
}

const ManagerRow = memo(function ManagerRow({
  employee,
  rank,
  maxRevenue,
  benchmarks,
  isSelected,
  onSelect,
}: ManagerRowProps) {
  const handleClick = useCallback(() => {
    onSelect?.(employee.id)
  }, [employee.id, onSelect])

  const planPercent = employee.planSales > 0
    ? toDecimal(employee.metrics.monthlySalesAmount).dividedBy(employee.planSales).times(100).toDecimalPlaces(0).toNumber()
    : 0
  const revenueColor = getRevenueColor(employee.metrics.monthlySalesAmount, employee.planSales)
  const revenueFill = maxRevenue > 0
    ? Math.min(toDecimal(employee.metrics.monthlySalesAmount).dividedBy(maxRevenue).times(100).toNumber(), 100)
    : 0

  return (
    <tr
      onClick={onSelect ? handleClick : undefined}
      className={cn(
        'group transition-colors',
        onSelect ? 'cursor-pointer' : '',
        isSelected ? 'bg-[var(--primary)]/10' : 'hover:bg-[var(--muted)]/30'
      )}
    >
      <td className="px-4 py-8 text-center text-[var(--muted-foreground)]">
        {rank}
      </td>

      <td className="px-4 py-8 font-medium text-[var(--foreground)]">
        {employee.name}
      </td>

      <td className="px-4 py-8 text-right">
        <div className="flex flex-col items-end justify-center gap-1.5">
          <span className="font-bold tabular-nums text-[var(--foreground)]">
            {formatMoney(employee.metrics.monthlySalesAmount)}
          </span>

          <div className="w-full max-w-[120px] h-1.5 bg-[var(--muted)]/30 rounded-full overflow-hidden flex justify-end ml-auto relative">
            <div
              className="absolute right-0 top-0 bottom-0 rounded-full"
              style={{
                width: `${revenueFill}%`,
                backgroundColor: revenueColor,
              }}
            />
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">
            {planPercent}% плана
          </div>
        </div>
      </td>

      <td className="px-4 py-8 text-right font-semibold tabular-nums text-[var(--foreground)]">
        {employee.metrics.successfulDeals}
      </td>

      <td className={cn('px-2 py-8 text-right tabular-nums text-xs border-l border-dashed border-[var(--border)]/50', getCellClass(employee.conversions.bookedToZoom1, benchmarks.BOOKED_TO_ZOOM1))}>
        {employee.conversions.bookedToZoom1}%
      </td>
      <td className={cn('px-2 py-8 text-right tabular-nums text-xs border-l border-dashed border-[var(--border)]/50', getCellClass(employee.conversions.zoom1ToZoom2, benchmarks.ZOOM1_TO_ZOOM2))}>
        {employee.conversions.zoom1ToZoom2}%
      </td>
      <td className={cn('px-2 py-8 text-right tabular-nums text-xs border-l border-dashed border-[var(--border)]/50', getCellClass(employee.conversions.zoom2ToContract, benchmarks.ZOOM2_TO_CONTRACT))}>
        {employee.conversions.zoom2ToContract}%
      </td>
    </tr>
  )
})

export const ManagersTable = memo(function ManagersTable({
  employees,
  selectedId,
  onSelectEmployee,
  benchmarks,
  error,
  onRetry,
}: ManagersTableProps) {
  const mergedBenchmarks: ConversionBenchmarkConfig = {
    ...CONVERSION_BENCHMARKS,
    ...(benchmarks ?? {}),
  }

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort(
        (a, b) => b.metrics.monthlySalesAmount - a.metrics.monthlySalesAmount
      ),
    [employees]
  )

  const maxRevenue = useMemo(
    () => Math.max(...employees.map((employee) => employee.metrics.monthlySalesAmount), 1),
    [employees]
  )

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-sm text-[var(--danger)] mb-3">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-primary">
            Повторить
          </button>
        )}
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]">
        <p>Нет данных по менеджерам</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm border-collapse" aria-label="Эффективность менеджеров">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)] text-xs uppercase tracking-wider">
            <th className="px-4 py-4 text-left font-medium w-12">#</th>
            <th className="px-4 py-4 text-left font-medium min-w-[160px]">Менеджер</th>
            <th className="px-4 py-4 text-right font-medium min-w-[180px]">Выручка (KPI)</th>
            <th className="px-4 py-4 text-right font-medium w-24">Сделки</th>
            <th className="px-2 py-4 text-right font-medium w-24">Конв.<br/>Запись</th>
            <th className="px-2 py-4 text-right font-medium w-24">Конв.<br/>Zoom 1</th>
            <th className="px-2 py-4 text-right font-medium w-24">Конв.<br/>Zoom 2</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {sortedEmployees.map((employee, index) => (
            <ManagerRow
              key={employee.id}
              employee={employee}
              rank={index + 1}
              maxRevenue={maxRevenue}
              benchmarks={mergedBenchmarks}
              isSelected={employee.id === selectedId}
              onSelect={onSelectEmployee}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
})
