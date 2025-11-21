#!/usr/bin/env tsx

/**
 * Валидация финансовых данных в системе Callwork
 *
 * Проверяет:
 * - Точность decimal конверсий
 * - Согласованность целей команды
 * - Аномалии в отчётах
 * - Корректность расчётов метрик
 *
 * Usage:
 *   npx tsx scripts/validate-financial-data.ts
 *   npx tsx scripts/validate-financial-data.ts --detailed
 *   npx tsx scripts/validate-financial-data.ts --fix
 */

import { prisma } from '@/lib/prisma'
import { GoalService } from '@/lib/services/GoalService'
import Decimal from 'decimal.js'

interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO'
  category: string
  message: string
  data?: any
}

const issues: ValidationIssue[] = []

// Флаги командной строки
const args = process.argv.slice(2)
const isDetailed = args.includes('--detailed')
const shouldFix = args.includes('--fix')

async function validateGoals() {
  console.log('\n🎯 Проверка целей (monthlyGoal)...\n')

  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true },
    include: {
      employees: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          monthlyGoal: true
        }
      }
    }
  })

  for (const manager of managers) {
    const breakdown = await GoalService.getTeamGoalBreakdown(manager.id)

    // Проверка 1: Все активные сотрудники имеют цели
    if (breakdown.usersWithoutGoals > 0) {
      issues.push({
        severity: 'ERROR',
        category: 'Goals',
        message: `Менеджер ${manager.name}: ${breakdown.usersWithoutGoals} сотрудников без целей`,
        data: breakdown.breakdown.filter(u => u.goal === 0)
      })
    }

    // Проверка 2: Согласованность суммы
    const managerGoal = new Decimal(manager.monthlyGoal || 0)
    const employeesGoal = breakdown.breakdown
      .filter(u => u.role === 'EMPLOYEE')
      .reduce((sum, u) => sum.plus(new Decimal(u.goal)), new Decimal(0))

    const teamGoal = managerGoal.plus(employeesGoal)
    const expectedGoal = new Decimal(breakdown.totalGoal)

    if (!teamGoal.equals(expectedGoal)) {
      issues.push({
        severity: 'ERROR',
        category: 'Goals',
        message: `Менеджер ${manager.name}: Несоответствие суммы целей`,
        data: {
          manager: managerGoal.toNumber(),
          employees: employeesGoal.toNumber(),
          total: teamGoal.toNumber(),
          expected: expectedGoal.toNumber()
        }
      })
    }

    // Проверка 3: Реалистичность
    const avgEmployeeGoal = employeesGoal.dividedBy(manager.employees.length || 1)
    if (avgEmployeeGoal.greaterThan(5000000)) {
      issues.push({
        severity: 'WARNING',
        category: 'Goals',
        message: `Менеджер ${manager.name}: Цель > 5 млн на сотрудника может быть нереалистичной`,
        data: { avgGoal: avgEmployeeGoal.toNumber() }
      })
    }

    if (isDetailed) {
      console.log(`✅ ${manager.name}: ${breakdown.teamSize} человек, цель ${breakdown.totalGoal.toLocaleString()} ₽`)
    }
  }
}

async function validateReports() {
  console.log('\n📊 Проверка отчётов (Reports)...\n')

  // Получить все отчёты за последние 30 дней
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  const reports = await prisma.report.findMany({
    where: {
      date: { gte: startDate }
    },
    include: {
      user: {
        select: { name: true, role: true }
      }
    }
  })

  for (const report of reports) {
    // Проверка 1: Отрицательные значения
    const negativeFields = []
    if (report.monthlySalesAmount < 0) negativeFields.push('monthlySalesAmount')
    if (report.successfulDeals < 0) negativeFields.push('successfulDeals')
    if (report.zoomAppointments < 0) negativeFields.push('zoomAppointments')

    if (negativeFields.length > 0) {
      issues.push({
        severity: 'ERROR',
        category: 'Reports',
        message: `Отрицательные значения в отчёте ${report.user.name} от ${report.date.toLocaleDateString()}`,
        data: { fields: negativeFields, reportId: report.id }
      })
    }

    // Проверка 2: Аномально большие значения
    const salesAmount = new Decimal(report.monthlySalesAmount)
    if (salesAmount.greaterThan(10000000)) {
      issues.push({
        severity: 'WARNING',
        category: 'Reports',
        message: `Очень большая выручка в одном отчёте: ${report.user.name} ${salesAmount.toNumber().toLocaleString()} ₽`,
        data: { reportId: report.id, date: report.date }
      })
    }

    // Проверка 3: Логическая согласованность воронки
    const {
      zoomAppointments,
      pzmConducted,
      vzmConducted,
      contractReviewCount,
      successfulDeals
    } = report

    if (pzmConducted > zoomAppointments) {
      issues.push({
        severity: 'WARNING',
        category: 'Reports',
        message: `${report.user.name}: PZM > Zoom Appointments (нелогично)`,
        data: { reportId: report.id }
      })
    }

    if (successfulDeals > contractReviewCount) {
      issues.push({
        severity: 'WARNING',
        category: 'Reports',
        message: `${report.user.name}: Deals > Contract Reviews (невозможно)`,
        data: { reportId: report.id }
      })
    }
  }

  if (isDetailed) {
    console.log(`✅ Проверено ${reports.length} отчётов`)
  }
}

async function validateDeals() {
  console.log('\n💼 Проверка сделок (Deals)...\n')

  const deals = await prisma.deal.findMany({
    include: {
      user: {
        select: { name: true }
      }
    }
  })

  for (const deal of deals) {
    // Проверка 1: Отрицательный budget
    if (deal.budget < 0) {
      issues.push({
        severity: 'ERROR',
        category: 'Deals',
        message: `Отрицательный budget в сделке "${deal.title}"`,
        data: { dealId: deal.id, budget: deal.budget }
      })
    }

    // Проверка 2: Очень большой budget
    const budget = new Decimal(deal.budget)
    if (budget.greaterThan(50000000)) {
      issues.push({
        severity: 'WARNING',
        category: 'Deals',
        message: `Очень большой budget: ${deal.title} - ${budget.toNumber().toLocaleString()} ₽`,
        data: { dealId: deal.id }
      })
    }

    // Проверка 3: Закрытая сделка без даты
    if (deal.status === 'CLOSED' && !deal.closedAt) {
      issues.push({
        severity: 'WARNING',
        category: 'Deals',
        message: `Закрытая сделка без даты закрытия: ${deal.title}`,
        data: { dealId: deal.id }
      })
    }
  }

  if (isDetailed) {
    console.log(`✅ Проверено ${deals.length} сделок`)
  }
}

async function validateMetrics() {
  console.log('\n📈 Проверка метрик...\n')

  // Получить всех менеджеров
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true }
  })

  for (const manager of managers) {
    // Получить отчёты команды за текущий месяц
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const teamReports = await prisma.report.findMany({
      where: {
        user: {
          OR: [
            { id: manager.id },
            { managerId: manager.id }
          ],
          isActive: true
        },
        date: {
          gte: startOfMonth,
          lte: now
        }
      }
    })

    // Рассчитать факт через Decimal.js
    const fact = teamReports.reduce(
      (sum, r) => sum.plus(new Decimal(r.monthlySalesAmount)),
      new Decimal(0)
    )

    // Получить план
    const plan = await GoalService.getTeamGoal(manager.id)
    const planDec = new Decimal(plan)

    // Проверить согласованность
    if (planDec.equals(0) && fact.greaterThan(0)) {
      issues.push({
        severity: 'WARNING',
        category: 'Metrics',
        message: `${manager.name}: Есть выручка (${fact.toNumber().toLocaleString()} ₽), но нет плана`,
        data: { managerId: manager.id }
      })
    }

    if (isDetailed) {
      const progress = planDec.greaterThan(0)
        ? fact.dividedBy(planDec).times(100).toFixed(1)
        : 0
      console.log(`  ${manager.name}: ${fact.toNumber().toLocaleString()} / ${planDec.toNumber().toLocaleString()} ₽ (${progress}%)`)
    }
  }
}

async function printReport() {
  console.log('\n' + '='.repeat(60))
  console.log('📋 ОТЧЁТ О ВАЛИДАЦИИ')
  console.log('='.repeat(60))

  if (issues.length === 0) {
    console.log('\n✅ Проблем не обнаружено! Все данные корректны.\n')
    return
  }

  // Группировка по severity
  const errors = issues.filter(i => i.severity === 'ERROR')
  const warnings = issues.filter(i => i.severity === 'WARNING')
  const info = issues.filter(i => i.severity === 'INFO')

  console.log(`\n🔴 ОШИБКИ: ${errors.length}`)
  errors.forEach((issue, index) => {
    console.log(`\n${index + 1}. [${issue.category}] ${issue.message}`)
    if (isDetailed && issue.data) {
      console.log('   Детали:', JSON.stringify(issue.data, null, 2))
    }
  })

  console.log(`\n⚠️  ПРЕДУПРЕЖДЕНИЯ: ${warnings.length}`)
  warnings.forEach((issue, index) => {
    console.log(`\n${index + 1}. [${issue.category}] ${issue.message}`)
    if (isDetailed && issue.data) {
      console.log('   Детали:', JSON.stringify(issue.data, null, 2))
    }
  })

  if (info.length > 0) {
    console.log(`\nℹ️  ИНФОРМАЦИЯ: ${info.length}`)
    info.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.category}] ${issue.message}`)
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log(`ИТОГО: ${errors.length} ошибок, ${warnings.length} предупреждений`)
  console.log('='.repeat(60) + '\n')
}

async function main() {
  console.log('🔍 Начинаю валидацию финансовых данных...')

  await validateGoals()
  await validateReports()
  await validateDeals()
  await validateMetrics()

  await printReport()

  if (shouldFix) {
    console.log('⚠️  Флаг --fix пока не реализован. Исправляйте ошибки вручную.')
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('❌ Ошибка при валидации:', error)
  process.exit(1)
})
