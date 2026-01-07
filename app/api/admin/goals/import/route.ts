import { NextResponse } from 'next/server'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import Decimal from 'decimal.js'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { GoalAdminService, type GoalUpdateInput } from '@/lib/services/GoalAdminService'
import { getClientIP } from '@/lib/rate-limit'
import { csrfError, validateOrigin } from '@/lib/csrf'

const MAX_MONEY = 1_000_000_000
const MAX_ROWS = 500
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIMES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const safeNumber = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  try {
    const decimal = new Decimal(value)
    if (!decimal.isFinite()) return undefined
    return decimal.toNumber()
  } catch {
    return undefined
  }
}

const parseGoalValue = (value: unknown) => {
  const parsed = safeNumber(value)
  if (parsed === undefined) return undefined
  if (parsed < 0 || parsed > MAX_MONEY) return undefined
  return parsed
}

const normalizeRow = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value])
  )

const rowSchema = z.object({
  email: z.string().email(),
  monthlyGoal: z.number().min(0).max(MAX_MONEY).nullable(),
})

const normalizeCellValue = (value: ExcelJS.CellValue) => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text
    }
    if ('result' in value) {
      return (value as ExcelJS.CellFormulaValue).result ?? null
    }
  }
  return value
}

export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return csrfError()
  }

  try {
    const manager = await requireManager()
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Файл слишком большой. Максимум: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    const fileName = file.name.toLowerCase()
    const isCsv = fileName.endsWith('.csv')
    const isXlsx = fileName.endsWith('.xlsx')
    const hasAllowedMime = ALLOWED_MIMES.includes(file.type)

    if (!hasAllowedMime && !isCsv && !isXlsx) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат файла. Используйте CSV или Excel.' },
        { status: 400 }
      )
    }

    let rows: Record<string, unknown>[] = []

    if (isCsv) {
      const text = await file.text()
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
      })
      if (parsed.errors.length > 0) {
        return NextResponse.json({ error: 'CSV файл содержит ошибки' }, { status: 400 })
      }
      rows = parsed.data
    } else {
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const sheet = workbook.worksheets[0]

      if (!sheet) {
        return NextResponse.json({ error: 'Файл не содержит листов' }, { status: 400 })
      }

      const headerRow = sheet.getRow(1)
      const headerValues = headerRow.values as ExcelJS.CellValue[]
      const headers = headerValues.map((value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : ''
      )

      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return
        if (rows.length >= MAX_ROWS + 1) return
        const rowValues = row.values as ExcelJS.CellValue[]
        const rowData: Record<string, unknown> = {}

        for (let i = 1; i < headers.length; i += 1) {
          const key = headers[i]
          if (!key) continue
          rowData[key] = normalizeCellValue(rowValues[i] ?? null)
        }

        rows.push(rowData)
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Файл пустой' }, { status: 400 })
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Файл содержит слишком много строк (лимит ${MAX_ROWS})` },
        { status: 400 }
      )
    }

    const prepared = rows.map((row, index) => {
      const normalized = normalizeRow(row)
      const emailRaw = normalized.email ?? normalized['e-mail'] ?? normalized['e_mail']
      const goalRaw =
        normalized.monthlygoal ?? normalized.goal ?? normalized['monthly_goal'] ?? normalized['monthly-goal']
      const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
      const goalValue = goalRaw === null ? null : parseGoalValue(goalRaw)
      return { index, email, goalValue }
    })

    const errors: string[] = []
    const emails = new Set<string>()
    prepared.forEach((row) => {
      if (!row.email) {
        errors.push(`Строка ${row.index + 2}: отсутствует email`)
        return
      }
      if (row.goalValue === undefined) {
        errors.push(`Строка ${row.index + 2}: некорректная цель`)
        return
      }
      emails.add(row.email)
    })

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Некорректный файл', details: errors }, { status: 400 })
    }

    const users = await prisma.user.findMany({
      where: {
        email: { in: Array.from(emails) },
        isActive: true,
        OR: [{ id: manager.id }, { managerId: manager.id }],
      },
      select: { id: true, email: true },
    })

    const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]))

    const updates: GoalUpdateInput[] = []
    for (const row of prepared) {
      const userId = userByEmail.get(row.email)
      if (!userId) {
        errors.push(`Email ${row.email} не найден в вашей команде`)
        continue
      }
      const parsed = rowSchema.safeParse({
        email: row.email,
        monthlyGoal: row.goalValue,
      })
      if (!parsed.success) {
        errors.push(`Email ${row.email}: неверные данные`)
        continue
      }
      updates.push({ userId, monthlyGoal: parsed.data.monthlyGoal })
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Ошибки в файле', details: errors }, { status: 400 })
    }

    const result = await GoalAdminService.applyGoalUpdates(manager.id, updates, {
      source: 'import',
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ ...result, processed: updates.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
