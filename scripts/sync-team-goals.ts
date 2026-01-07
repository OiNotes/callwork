#!/usr/bin/env tsx

/**
 * Синхронизация целей команды
 *
 * Usage:
 *   npx tsx scripts/sync-team-goals.ts --validate                    # Проверить согласованность
 *   npx tsx scripts/sync-team-goals.ts --manager="id" --distribute   # Распределить цели
 *   npx tsx scripts/sync-team-goals.ts --user="id" --goal=3000000   # Установить цель
 */

import { prisma } from '@/lib/prisma'
import { GoalService } from '@/lib/services/GoalService'
import { Decimal } from '@prisma/client/runtime/library'
import { logError } from '@/lib/logger'

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const arg = args.find(a => a.startsWith(`--${name}=`))
  return arg?.split('=')[1]
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

async function validateTeamGoals() {
  console.log('\n🔍 Проверка согласованности целей...\n')

  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER', isActive: true }
  })

  let totalIssues = 0

  for (const manager of managers) {
    const breakdown = await GoalService.getTeamGoalBreakdown(manager.id)

    console.log(`\n${manager.name}:`)
    console.log(`  Команда: ${breakdown.teamSize} человек`)
    console.log(`  Общая цель: ${breakdown.totalGoal.toLocaleString()} ₽`)

    // Проверка 1: Сотрудники без целей
    if (breakdown.usersWithoutGoals > 0) {
      console.log(`  ⚠️  ${breakdown.usersWithoutGoals} сотрудников без целей`)
      totalIssues++

      breakdown.breakdown
        .filter(u => u.goal === 0)
        .forEach(u => console.log(`     - ${u.name}`))
    }

    // Проверка 2: Согласованность
    const managerGoal = new Decimal(manager.monthlyGoal || 0)
    const employeesGoal = breakdown.breakdown
      .filter(u => u.role === 'EMPLOYEE')
      .reduce((sum, u) => sum.plus(new Decimal(u.goal)), new Decimal(0))

    const calculatedTotal = managerGoal.plus(employeesGoal)
    const expectedTotal = new Decimal(breakdown.totalGoal)

    if (!calculatedTotal.equals(expectedTotal)) {
      console.log(`  ⚠️  Несоответствие суммы:`)
      console.log(`     Менеджер: ${managerGoal.toNumber().toLocaleString()} ₽`)
      console.log(`     Сотрудники: ${employeesGoal.toNumber().toLocaleString()} ₽`)
      console.log(`     Рассчитано: ${calculatedTotal.toNumber().toLocaleString()} ₽`)
      console.log(`     Ожидалось: ${expectedTotal.toNumber().toLocaleString()} ₽`)
      totalIssues++
    } else {
      console.log(`  ✅ Согласованность подтверждена`)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  if (totalIssues === 0) {
    console.log('✅ Проблем не обнаружено')
  } else {
    console.log(`⚠️  Обнаружено проблем: ${totalIssues}`)
  }
  console.log('='.repeat(60) + '\n')
}

async function setUserGoal(userId: string, goal: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true }
  })

  if (!user) {
    logError(`Пользователь ${userId} не найден`)
    return
  }

  console.log(`\n📝 Установка цели для ${user.name}`)
  console.log(`   Роль: ${user.role}`)
  console.log(`   Новая цель: ${goal.toLocaleString()} ₽\n`)

  await prisma.user.update({
    where: { id: userId },
    data: { monthlyGoal: goal }
  })

  console.log('✅ Цель установлена\n')
}

async function distributeTeamGoal(managerId: string) {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    include: {
      managedUsers: {
        where: { isActive: true }
      }
    }
  })

  if (!manager) {
    logError(`Менеджер ${managerId} не найден`)
    return
  }

  console.log(`\n📊 Распределение целей для команды ${manager.name}\n`)

  const teamSize = manager.managedUsers.length + 1 // +1 для самого менеджера
  const totalGoal = Number(manager.monthlyGoal) || 14000000 // дефолт 14 млн

  console.log(`Общая цель: ${totalGoal.toLocaleString()} ₽`)
  console.log(`Размер команды: ${teamSize} (${manager.name} + ${manager.managedUsers.length} сотрудников)`)

  // Предложить распределение
  const managerShare = new Decimal(totalGoal).times(0.15) // 15% менеджеру
  const employeesTotal = new Decimal(totalGoal).minus(managerShare)
  const perEmployee = employeesTotal.dividedBy(manager.managedUsers.length || 1)

  console.log(`\nПредлагаемое распределение:`)
  console.log(`  Менеджер ${manager.name}: ${managerShare.toNumber().toLocaleString()} ₽ (15%)`)
  console.log(`  Каждый сотрудник: ${perEmployee.toNumber().toLocaleString()} ₽`)

  console.log(`\nПрименить? (CTRL+C для отмены, Enter для продолжения)`)

  // В production здесь был бы prompt
  // Для демонстрации просто выводим что будет сделано

  console.log(`\n⚠️  Для применения раскомментируйте код обновления в скрипте\n`)

  /*
  await prisma.user.update({
    where: { id: managerId },
    data: { monthlyGoal: managerShare.toNumber() }
  })

  for (const emp of manager.managedUsers) {
    await prisma.user.update({
      where: { id: emp.id },
      data: { monthlyGoal: perEmployee.toNumber() }
    })
  }

  console.log('✅ Цели распределены\n')
  */
}

async function main() {
  console.log('🎯 Управление целями команды')

  if (hasFlag('validate')) {
    await validateTeamGoals()
  } else if (hasFlag('distribute')) {
    const managerId = getArg('manager')
    if (!managerId) {
      logError('Укажите --manager="id"')
      process.exit(1)
    }
    await distributeTeamGoal(managerId)
  } else if (hasFlag('user') && hasFlag('goal')) {
    const userId = getArg('user')!
    const goal = parseInt(getArg('goal')!, 10)
    await setUserGoal(userId, goal)
  } else {
    console.log(`
Usage:
  npx tsx scripts/sync-team-goals.ts --validate
  npx tsx scripts/sync-team-goals.ts --manager="id" --distribute
  npx tsx scripts/sync-team-goals.ts --user="id" --goal=3000000
`)
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  logError('Ошибка при синхронизации целей', error)
  process.exit(1)
})
