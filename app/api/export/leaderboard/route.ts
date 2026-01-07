import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { sumDecimals, toNumber } from '@/lib/utils/decimal'
import { logError } from '@/lib/logger'
import { sanitizeForCsv } from '@/lib/utils/csv-sanitize'

const exportQuerySchema = z.object({
  format: z.enum(['xlsx', 'csv']),
  period: z.enum(['day', 'week', 'month']),
})

const MAX_EXPORT_ROWS = 1000

/**
 * GET /api/export/leaderboard
 *
 * Экспорт лидерборда в Excel или CSV (только для менеджеров)
 *
 * Query params:
 * - format: 'xlsx' | 'csv'
 * - period: 'day' | 'week' | 'month'
 */
export async function GET(request: Request) {
  try {
    const manager = await requireManager()
    const { searchParams } = new URL(request.url)

    const parsed = exportQuerySchema.safeParse({
      format: searchParams.get('format') ?? 'xlsx',
      period: searchParams.get('period') ?? 'month',
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const { format, period } = parsed.data

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        const dayOfWeek = now.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
        break
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    // Fetch team members with their reports
    const team = await prisma.user.findMany({
      where: manager.role === 'ADMIN'
        ? {
            isActive: true,
            role: { in: ['EMPLOYEE', 'MANAGER'] },
          }
        : {
            OR: [{ id: manager.id }, { managerId: manager.id }],
            isActive: true,
          },
      include: {
        reports: {
          where: {
            date: { gte: startDate },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: MAX_EXPORT_ROWS,
    })

    // Calculate metrics
    const data = team.map((member, index) => {
      const totalSales = toNumber(
        sumDecimals(member.reports.map((r) => r.monthlySalesAmount))
      )
      const totalDeals = member.reports.reduce((sum, r) => sum + r.successfulDeals, 0)
      const totalZoom = member.reports.reduce((sum, r) => sum + r.zoomAppointments, 0)
      const totalPzm = member.reports.reduce((sum, r) => sum + r.pzmConducted, 0)
      const totalVzm = member.reports.reduce((sum, r) => sum + r.vzmConducted, 0)
      const reportsCount = member.reports.length

      // Calculate conversion
      const conversion = totalPzm > 0 ? ((totalDeals / totalPzm) * 100).toFixed(1) : '0.0'

      return {
        'Место': 0, // Will be set after sorting
        'Сотрудник': sanitizeForCsv(member.name),
        'Email': sanitizeForCsv(member.email),
        'Роль': member.role === 'ADMIN'
          ? 'Администратор'
          : member.role === 'MANAGER'
            ? 'Менеджер'
            : 'Сотрудник',
        'Сумма продаж': totalSales,
        'Сделок': totalDeals,
        'Zoom записано': totalZoom,
        'ПЗМ': totalPzm,
        'ВЗМ': totalVzm,
        'Конверсия (%)': conversion,
        'Отчётов': reportsCount,
      }
    })

    // Sort by sales and assign ranks
    data.sort((a, b) => b['Сумма продаж'] - a['Сумма продаж'])
    data.forEach((row, index) => {
      row['Место'] = index + 1
    })

    const periodName = period === 'day' ? 'День' : period === 'week' ? 'Неделя' : 'Месяц'
    const dateStr = now.toISOString().split('T')[0]
    const filename = `leaderboard_${period}_${dateStr}.${format}`
    if (format === 'csv') {
      const csv = Papa.unparse(data)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(`Лидерборд (${periodName})`)
    const columns = [
      { header: 'Место', key: 'Место' },
      { header: 'Сотрудник', key: 'Сотрудник' },
      { header: 'Email', key: 'Email' },
      { header: 'Роль', key: 'Роль' },
      { header: 'Сумма продаж', key: 'Сумма продаж' },
      { header: 'Сделок', key: 'Сделок' },
      { header: 'Zoom записано', key: 'Zoom записано' },
      { header: 'ПЗМ', key: 'ПЗМ' },
      { header: 'ВЗМ', key: 'ВЗМ' },
      { header: 'Конверсия (%)', key: 'Конверсия (%)' },
      { header: 'Отчётов', key: 'Отчётов' },
    ]

    worksheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: Math.max(column.header.length + 2, 12),
    }))

    data.forEach((row) => worksheet.addRow(row))

    const buffer = await workbook.xlsx.writeBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Manager access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    logError('Export leaderboard error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
