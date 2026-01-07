import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { toDecimal, toNumber } from '@/lib/utils/decimal'
import { logError } from '@/lib/logger'
import { sanitizeForCsv } from '@/lib/utils/csv-sanitize'

const exportQuerySchema = z.object({
  format: z.enum(['xlsx', 'csv']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userId: z.string().cuid().optional(),
})

const MAX_EXPORT_DAYS = 90
const MAX_EXPORT_ROWS = 10000

/**
 * GET /api/export/reports
 *
 * Экспорт отчётов в Excel или CSV
 *
 * Query params:
 * - format: 'xlsx' | 'csv'
 * - startDate: ISO datetime
 * - endDate: ISO datetime
 * - userId: (optional) specific user ID (only for managers)
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const parsed = exportQuerySchema.safeParse({
      format: searchParams.get('format') ?? 'xlsx',
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      userId: searchParams.get('userId') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const { format, startDate, endDate, userId } = parsed.data
    const parsedStartDate = new Date(startDate)
    const parsedEndDate = new Date(endDate)
    const daysDiff = Math.ceil(
      (parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysDiff > MAX_EXPORT_DAYS) {
      return NextResponse.json(
        { error: `Максимальный период экспорта: ${MAX_EXPORT_DAYS} дней` },
        { status: 400 }
      )
    }

    // Determine target user(s)
    let targetUserIds: string[] = [user.id]

    if (userId) {
      if (user.role === 'MANAGER') {
        // Verify manager has access to this user
        const targetUser = await prisma.user.findFirst({
          where: {
            id: userId,
            isActive: true,
            OR: [{ managerId: user.id }, { id: user.id }],
          },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        targetUserIds = [userId]
      } else if (user.role === 'ADMIN') {
        const targetUser = await prisma.user.findFirst({
          where: { id: userId, isActive: true },
          select: { id: true },
        })
        if (!targetUser) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        targetUserIds = [userId]
      } else if (userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (user.role === 'MANAGER') {
      // Get all team members
      const team = await prisma.user.findMany({
        where: {
          OR: [{ id: user.id }, { managerId: user.id }],
          isActive: true,
        },
        select: { id: true },
      })
      targetUserIds = team.map(u => u.id)
    } else if (user.role === 'ADMIN') {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      targetUserIds = users.map(u => u.id)
    }

    // Fetch reports
    const reports = await prisma.report.findMany({
      where: {
        userId: { in: targetUserIds },
        date: {
          gte: parsedStartDate,
          lte: parsedEndDate,
        },
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: [{ date: 'desc' }, { userId: 'asc' }],
      take: MAX_EXPORT_ROWS + 1,
    })

    if (reports.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `Слишком много записей. Максимум: ${MAX_EXPORT_ROWS}. Уменьшите период.` },
        { status: 400 }
      )
    }

    // Transform to export format
    const data = reports.map(r => ({
      'Дата': r.date.toISOString().split('T')[0],
      'Сотрудник': sanitizeForCsv(r.user.name),
      'Email': sanitizeForCsv(r.user.email),
      'Zoom записано': r.zoomAppointments,
      'ПЗМ проведено': r.pzmConducted,
      'ВЗМ проведено': r.vzmConducted,
      'Контракт ревью': r.contractReviewCount,
      'Push': r.pushCount,
      'Сделок закрыто': r.successfulDeals,
      'Сумма продаж': toNumber(toDecimal(r.monthlySalesAmount)),
      'Отказов': r.refusalsCount,
      'На разогреве': r.warmingUpCount,
      'Комментарий': sanitizeForCsv(r.comment ?? ''),
    }))

    const filename = `reports_${startDate.split('T')[0]}_${endDate.split('T')[0]}.${format}`
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
    const worksheet = workbook.addWorksheet('Отчёты')
    const columns = [
      { header: 'Дата', key: 'Дата' },
      { header: 'Сотрудник', key: 'Сотрудник' },
      { header: 'Email', key: 'Email' },
      { header: 'Zoom записано', key: 'Zoom записано' },
      { header: 'ПЗМ проведено', key: 'ПЗМ проведено' },
      { header: 'ВЗМ проведено', key: 'ВЗМ проведено' },
      { header: 'Контракт ревью', key: 'Контракт ревью' },
      { header: 'Push', key: 'Push' },
      { header: 'Сделок закрыто', key: 'Сделок закрыто' },
      { header: 'Сумма продаж', key: 'Сумма продаж' },
      { header: 'Отказов', key: 'Отказов' },
      { header: 'На разогреве', key: 'На разогреве' },
      { header: 'Комментарий', key: 'Комментарий' },
    ]

    worksheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: Math.max(column.header.length + 2, 14),
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
    logError('Export reports error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
