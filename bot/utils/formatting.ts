import { ReportData } from '../types'
import { roundMoney, toDecimal, toNumber } from '../../lib/utils/decimal'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function formatReportPreview(data: Partial<ReportData>, date: Date): string {
  const dateStr = formatDate(date)
  const refusalsReasons = data.refusalsReasons ? sanitizeText(data.refusalsReasons) : ''

  return `
📊 Отчёт за ${dateStr}

✅ Записи на ПЗМ: ${data.zoomAppointments ?? 0}
✅ Проведено ПЗМ: ${data.pzmConducted ?? 0}
${data.refusalsCount ? `❌ Отказы: ${data.refusalsCount}${refusalsReasons ? ` (${refusalsReasons})` : ''}` : ''}
🔥 Подогрев: ${data.warmingUpCount ?? 0}
✅ Проведено ВЗМ: ${data.vzmConducted ?? 0}
📋 Разбор договора: ${data.contractReviewCount ?? 0}
💰 Закрыто сделок: ${data.successfulDeals ?? 0}
💵 Сумма продаж: ${formatCurrency(data.monthlySalesAmount ?? '0')}

Всё верно?
  `.trim()
}

export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export function formatCurrency(amount: string | number): string {
  const numeric = toNumber(roundMoney(toDecimal(amount)))
  return `${numeric.toLocaleString('ru-RU')} ₽`
}
