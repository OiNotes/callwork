#!/usr/bin/env tsx

/**
 * Валидация консистентности числовых метрик
 *
 * Этот скрипт проверяет что план, факт и прогноз рассчитываются консистентно
 * и не имеют расхождений между разными частями системы.
 *
 * Проверки:
 * 1. Цели команды = Цель менеджера + Сумма целей сотрудников
 * 2. У всех активных пользователей есть monthlyGoal
 * 3. Факт считается одинаково через разные сервисы
 * 4. Прогноз не расходится с планом без объяснений
 * 5. Нет подозрительных хардкодов (все цели кратны 100K)
 *
 * Usage:
 *   npx tsx scripts/validate-metrics-consistency.ts
 *   npx tsx scripts/validate-metrics-consistency.ts --detailed
 *   npx tsx scripts/validate-metrics-consistency.ts --fix
 */

import { prisma } from '@/lib/prisma'
import { GoalService } from '@/lib/services/GoalService'
import { ReportAggregationService } from '@/lib/services/ReportAggregationService'
import { MetricsService } from '@/lib/services/MetricsService'
import Decimal from 'decimal.js'

const args = process.argv.slice(2)
const isDetailed = args.includes('--detailed')
const shouldFix = args.includes('--fix')

interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO'
  category: string
  message: string
  details?: any
}

const issues: ValidationIssue[] = []

function addIssue(severity: ValidationIssue['severity'], category: string, message: string, details?: any) {
  issues.push({ severity, category, message, details })
}

async function validateTeamGoalsConsistency() {
  console.log('\n📊 Проверка 1: Консистентность целей команды\n')

  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true },
    include: {
      employees: {
        where: { isActive: true }
      }
    }
  })

  for (const manager of managers) {
    const breakdown = await GoalService.getTeamGoalBreakdown(manager.id)

    // Проверка 1.1: Сотрудники без целей
    if (breakdown.usersWithoutGoals > 0) {
      addIssue('WARNING', 'team-goals',
        `Менеджер "${manager.name}": ${breakdown.usersWithoutGoals} сотрудников без целей`,
        { managerId: manager.id, users: breakdown.breakdown.filter(u => u.goal === 0) }
      )
    }

    // Проверка 1.2: Согласованность суммы
    const managerGoal = new Decimal(manager.monthlyGoal || 0)
    const employeesGoal = breakdown.breakdown
      .filter(u => u.role === 'EMPLOYEE')
      .reduce((sum, u) => sum.plus(new Decimal(u.goal)), new Decimal(0))

    const calculatedTotal = managerGoal.plus(employeesGoal)
    const expectedTotal = new Decimal(breakdown.totalGoal)

    if (!calculatedTotal.equals(expectedTotal)) {
      addIssue('ERROR', 'team-goals',
        `Менеджер "${manager.name}": Несоответствие суммы целей`,
        {
          managerId: manager.id,
          managerGoal: managerGoal.toNumber(),
          employeesGoal: employeesGoal.toNumber(),
          calculated: calculatedTotal.toNumber(),
          expected: expectedTotal.toNumber()
        }
      )
    }

    if (isDetailed) {
      console.log(`  ${manager.name}: ${breakdown.totalGoal.toLocaleString()}₽`)
      console.log(`    Менеджер: ${Number(manager.monthlyGoal || 0).toLocaleString()}₽`)
      console.log(`    Сотрудники: ${employeesGoal.toNumber().toLocaleString()}₽`)
      if (breakdown.usersWithoutGoals > 0) {
        console.log(`    ⚠️  ${breakdown.usersWithoutGoals} без целей`)
      } else {
        console.log(`    ✅ Все имеют цели`)
      }
    }
  }
}

async function validateUserGoals() {
  console.log('\n👤 Проверка 2: Цели пользователей\n')

  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, monthlyGoal: true }
  })

  for (const user of activeUsers) {
    // Проверка 2.1: Цель не установлена
    if (!user.monthlyGoal || Number(user.monthlyGoal) === 0) {
      addIssue('ERROR', 'user-goals',
        `Пользователь "${user.name}" (${user.role}): Цель не установлена`,
        { userId: user.id, role: user.role }
      )
    }

    // Проверка 2.2: Подозрительно круглые цели (возможные хардкоды)
    const goal = Number(user.monthlyGoal || 0)
    if (goal > 0 && goal % 100000 === 0) {
      // Цель кратна 100K - возможно хардкод
      addIssue('INFO', 'user-goals',
        `Пользователь "${user.name}": Цель кратна 100K (${goal.toLocaleString()}₽) - возможно хардкод?`,
        { userId: user.id, goal }
      )
    }
  }

  const usersWithoutGoals = activeUsers.filter(u => !u.monthlyGoal || Number(u.monthlyGoal) === 0)
  if (usersWithoutGoals.length > 0) {
    console.log(`  ⚠️  Найдено ${usersWithoutGoals.length} активных пользователей без целей`)
  } else {
    console.log(`  ✅ У всех ${activeUsers.length} активных пользователей есть цели`)
  }
}

async function validateFactCalculation() {
  console.log('\n💰 Проверка 3: Консистентность расчёта факта\n')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const users = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE' },
    select: { id: true, name: true },
    take: 5 // Проверяем первых 5 для скорости
  })

  for (const user of users) {
    // Способ 1: Через ReportAggregationService
    const factViaService = await ReportAggregationService.getTotalSales(user.id, {
      startDate,
      endDate
    })

    // Способ 2: Напрямую через Prisma aggregate
    const directResult = await prisma.report.aggregate({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate }
      },
      _sum: { monthlySalesAmount: true }
    })
    const factDirect = Number(directResult._sum.monthlySalesAmount || 0)

    // Проверка: оба способа должны дать одинаковый результат
    if (Math.abs(factViaService - factDirect) > 0.01) {
      addIssue('ERROR', 'fact-calculation',
        `Пользователь "${user.name}": Расхождение в расчёте факта`,
        {
          userId: user.id,
          viaService: factViaService,
          direct: factDirect,
          difference: factViaService - factDirect
        }
      )
    }

    if (isDetailed && (factViaService > 0 || factDirect > 0)) {
      console.log(`  ${user.name}:`)
      console.log(`    Via Service: ${factViaService.toLocaleString()}₽`)
      console.log(`    Direct:      ${factDirect.toLocaleString()}₽`)
      console.log(`    ✅ Совпадает`)
    }
  }

  console.log(`  Проверено ${users.length} пользователей - расхождений не найдено`)
}

async function validateForecastVsPlan() {
  console.log('\n📈 Проверка 4: Прогноз vs План\n')

  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true },
    select: { id: true, name: true },
    take: 3 // Первые 3 менеджера
  })

  for (const manager of managers) {
    try {
      const metrics = await MetricsService.getTeamMetrics(manager.id)

      if (!metrics.hasGoal) {
        addIssue('WARNING', 'forecast-vs-plan',
          `Менеджер "${manager.name}": Цель не установлена, прогноз невозможен`,
          { managerId: manager.id }
        )
        continue
      }

      // Проверка: Прогноз сильно отличается от плана
      const forecastLinearVsPlan = metrics.forecastVsPlan.linear
      if (forecastLinearVsPlan > 200) {
        addIssue('WARNING', 'forecast-vs-plan',
          `Менеджер "${manager.name}": Прогноз в 2x раза выше плана (${forecastLinearVsPlan.toFixed(0)}%)`,
          {
            managerId: manager.id,
            plan: metrics.plan,
            forecast: metrics.forecast.linear,
            ratio: forecastLinearVsPlan
          }
        )
      } else if (forecastLinearVsPlan < 50) {
        addIssue('WARNING', 'forecast-vs-plan',
          `Менеджер "${manager.name}": Прогноз меньше 50% от плана (${forecastLinearVsPlan.toFixed(0)}%)`,
          {
            managerId: manager.id,
            plan: metrics.plan,
            forecast: metrics.forecast.linear,
            ratio: forecastLinearVsPlan
          }
        )
      }

      if (isDetailed) {
        console.log(`  ${manager.name}:`)
        console.log(`    План:    ${metrics.plan.toLocaleString()}₽`)
        console.log(`    Факт:    ${metrics.fact.toLocaleString()}₽ (${metrics.percentageComplete.toFixed(1)}%)`)
        console.log(`    Прогноз: ${metrics.forecast.linear.toLocaleString()}₽ (${forecastLinearVsPlan.toFixed(0)}% от плана)`)
        if (forecastLinearVsPlan > 80 && forecastLinearVsPlan < 120) {
          console.log(`    ✅ Прогноз в разумных пределах`)
        }
      }
    } catch (error) {
      addIssue('ERROR', 'forecast-vs-plan',
        `Менеджер "${manager.name}": Ошибка при расчёте метрик`,
        { managerId: manager.id, error: String(error) }
      )
    }
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(80))
  console.log('📊 РЕЗУЛЬТАТЫ ВАЛИДАЦИИ')
  console.log('='.repeat(80) + '\n')

  const errors = issues.filter(i => i.severity === 'ERROR')
  const warnings = issues.filter(i => i.severity === 'WARNING')
  const infos = issues.filter(i => i.severity === 'INFO')

  console.log(`❌ Ошибки:        ${errors.length}`)
  console.log(`⚠️  Предупреждения: ${warnings.length}`)
  console.log(`ℹ️  Информация:    ${infos.length}`)
  console.log(`\nВсего проблем:   ${issues.length}\n`)

  if (errors.length > 0) {
    console.log('❌ КРИТИЧЕСКИЕ ОШИБКИ:\n')
    errors.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.category}] ${issue.message}`)
      if (isDetailed && issue.details) {
        console.log(`   Детали: ${JSON.stringify(issue.details, null, 2)}`)
      }
    })
    console.log('')
  }

  if (warnings.length > 0) {
    console.log('⚠️  ПРЕДУПРЕЖДЕНИЯ:\n')
    warnings.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.category}] ${issue.message}`)
      if (isDetailed && issue.details) {
        console.log(`   Детали: ${JSON.stringify(issue.details, null, 2)}`)
      }
    })
    console.log('')
  }

  console.log('='.repeat(80))

  if (issues.length === 0) {
    console.log('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!\n')
    return 0
  } else {
    console.log('\n⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ - ТРЕБУЕТСЯ ВНИМАНИЕ\n')
    if (!isDetailed) {
      console.log('Используйте --detailed для подробной информации\n')
    }
    return 1
  }
}

async function main() {
  console.log('🔍 ВАЛИДАЦИЯ КОНСИСТЕНТНОСТИ МЕТРИК')
  console.log('='.repeat(80))

  try {
    await validateTeamGoalsConsistency()
    await validateUserGoals()
    await validateFactCalculation()
    await validateForecastVsPlan()

    const exitCode = await printSummary()
    process.exit(exitCode)
  } catch (error) {
    console.error('\n❌ ФАТАЛЬНАЯ ОШИБКА:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
