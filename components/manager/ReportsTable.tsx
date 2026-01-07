'use client'

import { memo } from 'react'
import { formatDate, formatMoney } from '@/lib/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileText } from 'lucide-react'

interface Report {
  id: string
  date: string // ISO string from API
  zoomAppointments: number
  pzmConducted: number
  vzmConducted: number
  contractReviewCount?: number
  pushCount?: number
  successfulDeals: number
  monthlySalesAmount: number
  refusalsCount?: number
}

interface ReportsTableProps {
  reports: Report[]
}

export const ReportsTable = memo(function ReportsTable({ reports }: ReportsTableProps) {
  const calculateConversion = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)

  if (reports.length === 0) {
    return (
      <EmptyState
        title="Отчётов пока нет"
        description="Сотрудники ещё не отправляли отчёты за выбранный период."
        actionLabel="Открыть отчёты"
        actionHref="/dashboard/report"
        icon={<FileText className="w-6 h-6" />}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" aria-label="Отчёты сотрудников">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Дата</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Записаны</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">1-й Zoom</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">2-й Zoom</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Договор</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Дожим</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Оплаты</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Отказы</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">Продажи</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-[var(--muted-foreground)]">KPI 1-й Zoom → Оплата</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const kpi = calculateConversion(report.successfulDeals, report.pzmConducted)
            return (
              <tr key={report.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                <td className="py-3 px-4 text-sm text-[var(--foreground)]">{formatDate(report.date)}</td>
                <td className="py-3 px-4 text-sm text-right text-[var(--foreground)]">{report.zoomAppointments}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-[var(--foreground)]">{report.pzmConducted}</td>
                <td className="py-3 px-4 text-sm text-right text-[var(--foreground)]">{report.vzmConducted}</td>
                <td className="py-3 px-4 text-sm text-right text-[var(--foreground)]">{report.contractReviewCount ?? 0}</td>
                <td className="py-3 px-4 text-sm text-right text-[var(--foreground)]">{report.pushCount ?? 0}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-[var(--success)]">
                  {report.successfulDeals}
                </td>
                <td className="py-3 px-4 text-sm text-right text-[var(--foreground)]">{report.refusalsCount ?? 0}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-[var(--foreground)]">
                  {formatMoney(report.monthlySalesAmount)}
                </td>
                <td className="py-3 px-4 text-sm text-right">
                  <span
                    className={`inline-block px-2 py-1 rounded-[var(--radius-sm)] ${
                      kpi >= 5
                        ? 'bg-[var(--success)]/10 text-[var(--success)]'
                        : kpi >= 3
                        ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                        : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                    }`}
                  >
                    {kpi}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
