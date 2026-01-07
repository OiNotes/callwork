#!/usr/bin/env tsx
/**
 * 🚨 NUKE DATABASE - Полная очистка всех данных
 *
 * ВНИМАНИЕ: Этот скрипт удаляет ВСЕ данные из базы:
 * - Все пользователи
 * - Все отчёты
 * - Все сделки
 * - Все алерты
 * - Все грейды мотивации
 *
 * Использование:
 *   npx tsx scripts/nuke-database.ts --check     # Показать что будет удалено
 *   npx tsx scripts/nuke-database.ts --confirm   # УДАЛИТЬ ВСЁ (необратимо!)
 */

import { PrismaClient } from '@prisma/client'
import { logError } from '../lib/logger'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('\n📊 ПРОВЕРКА БАЗЫ ДАННЫХ\n')
  console.log('=' .repeat(60))

  try {
    const [
      usersCount,
      reportsCount,
      dealsCount,
      alertsCount,
      gradesCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.report.count(),
      prisma.deal.count(),
      prisma.alert.count(),
      prisma.motivationGrade.count()
    ])

    console.log(`👤 Пользователи (User):           ${usersCount.toString().padStart(6)}`)
    console.log(`📝 Отчёты (Report):               ${reportsCount.toString().padStart(6)}`)
    console.log(`💼 Сделки (Deal):                 ${dealsCount.toString().padStart(6)}`)
    console.log(`🔔 Алерты (Alert):                ${alertsCount.toString().padStart(6)}`)
    console.log(`📊 Грейды мотивации (Grade):      ${gradesCount.toString().padStart(6)}`)
    console.log('=' .repeat(60))
    console.log(`🗑️  ВСЕГО ЗАПИСЕЙ:                ${(usersCount + reportsCount + dealsCount + alertsCount + gradesCount).toString().padStart(6)}`)

    // Показать примеры пользователей
    if (usersCount > 0) {
      console.log('\n👥 Примеры пользователей:')
      const users = await prisma.user.findMany({
        take: 5,
        select: { name: true, email: true, role: true, isActive: true }
      })
      users.forEach(u => {
        const status = u.isActive ? '✅' : '❌'
        console.log(`   ${status} ${u.name} (${u.email}) - ${u.role}`)
      })
      if (usersCount > 5) {
        console.log(`   ... и ещё ${usersCount - 5} пользователей`)
      }
    }

    // Показать примеры отчётов
    if (reportsCount > 0) {
      console.log('\n📋 Примеры отчётов:')
      const reports = await prisma.report.findMany({
        take: 3,
        orderBy: { date: 'desc' },
        include: { user: { select: { name: true } } }
      })
      reports.forEach(r => {
        console.log(`   ${r.date.toISOString().split('T')[0]} - ${r.user.name}`)
      })
      if (reportsCount > 3) {
        console.log(`   ... и ещё ${reportsCount - 3} отчётов`)
      }
    }

    console.log('\n')
    return {
      usersCount,
      reportsCount,
      dealsCount,
      alertsCount,
      gradesCount,
      total: usersCount + reportsCount + dealsCount + alertsCount + gradesCount
    }
  } catch (error) {
    logError('Ошибка подключения к базе', error)
    throw error
  }
}

async function nukeDatabase() {
  console.log('\n💣 НАЧАЛО УНИЧТОЖЕНИЯ ДАННЫХ\n')
  console.log('Удаление в правильном порядке (учитывая foreign keys)...\n')

  try {
    // 1. Удаляем Alert (зависит от User)
    console.log('🔔 Удаление алертов...')
    const deletedAlerts = await prisma.alert.deleteMany({})
    console.log(`   ✅ Удалено: ${deletedAlerts.count}`)

    // 2. Удаляем Report (зависит от User)
    console.log('📝 Удаление отчётов...')
    const deletedReports = await prisma.report.deleteMany({})
    console.log(`   ✅ Удалено: ${deletedReports.count}`)

    // 3. Удаляем Deal (зависит от User)
    console.log('💼 Удаление сделок...')
    const deletedDeals = await prisma.deal.deleteMany({})
    console.log(`   ✅ Удалено: ${deletedDeals.count}`)

    // 4. Удаляем MotivationGrade (независима)
    console.log('📊 Удаление грейдов мотивации...')
    const deletedGrades = await prisma.motivationGrade.deleteMany({})
    console.log(`   ✅ Удалено: ${deletedGrades.count}`)

    // 5. Удаляем User (последним!)
    console.log('👤 Удаление пользователей...')
    const deletedUsers = await prisma.user.deleteMany({})
    console.log(`   ✅ Удалено: ${deletedUsers.count}`)

    console.log('\n' + '='.repeat(60))
    console.log('✅ БАЗА ДАННЫХ ПОЛНОСТЬЮ ОЧИЩЕНА')
    console.log('='.repeat(60))
    console.log(`\n🗑️  Всего удалено: ${
      deletedAlerts.count +
      deletedReports.count +
      deletedDeals.count +
      deletedGrades.count +
      deletedUsers.count
    } записей\n`)

    return {
      alerts: deletedAlerts.count,
      reports: deletedReports.count,
      deals: deletedDeals.count,
      grades: deletedGrades.count,
      users: deletedUsers.count
    }
  } catch (error) {
    logError('Ошибка при удалении', error)
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
🚨 ВНИМАНИЕ: Это скрипт для ПОЛНОГО УДАЛЕНИЯ всех данных!

Использование:
  npx tsx scripts/nuke-database.ts --check     # Проверить что будет удалено
  npx tsx scripts/nuke-database.ts --confirm   # УДАЛИТЬ ВСЁ (необратимо!)

⚠️  Для безопасности требуется флаг --confirm
`)
    process.exit(0)
  }

  if (args.includes('--check')) {
    await checkDatabase()
    console.log('💡 Для удаления всех данных запустите:')
    console.log('   npx tsx scripts/nuke-database.ts --confirm\n')
    process.exit(0)
  }

  if (args.includes('--confirm')) {
    console.log('\n⚠️  ⚠️  ⚠️  ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ ⚠️  ⚠️  ⚠️\n')
    console.log('Вы собираетесь УДАЛИТЬ ВСЕ ДАННЫЕ из базы!')
    console.log('Это действие НЕОБРАТИМО!\n')

    // Показать что будет удалено
    const stats = await checkDatabase()

    if (stats.total === 0) {
      console.log('✅ База данных уже пустая. Нечего удалять.\n')
      process.exit(0)
    }

    console.log('\n⏳ Начинаю удаление через 3 секунды...')
    console.log('   (Нажмите Ctrl+C для отмены)\n')

    await new Promise(resolve => setTimeout(resolve, 3000))

    await nukeDatabase()

    // Проверка после удаления
    console.log('\n🔍 Проверка результата:\n')
    const finalStats = await checkDatabase()

    if (finalStats.total === 0) {
      console.log('✅ База данных успешно очищена!\n')
    } else {
      console.log('⚠️  Возможно остались записи. Проверьте вручную.\n')
    }

    process.exit(0)
  }

  console.log('❌ Неизвестный флаг. Используйте --check или --confirm\n')
  process.exit(1)
}

main()
  .catch(error => {
    logError('Критическая ошибка', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
