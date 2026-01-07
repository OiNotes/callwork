#!/usr/bin/env tsx
/**
 * Создание тестовых сотрудников с отчётами
 *
 * Создаёт 5 сотрудников, привязывает к руководителю и генерирует отчёты за последние 30 дней
 */

import { PrismaClient } from '@prisma/client'
import { resolvePasswordHash } from './utils/password'
import { subDays, startOfDay } from 'date-fns'
import { logError } from '../lib/logger'

const prisma = new PrismaClient()

// Тестовые данные сотрудников
const EMPLOYEES = [
  {
    email: 'ivanov@callwork.com',
    name: 'Иван Иванов',
    monthlyGoal: 1800000, // 1.8 млн
  },
  {
    email: 'petrova@callwork.com',
    name: 'Мария Петрова',
    monthlyGoal: 2200000, // 2.2 млн
  },
  {
    email: 'sidorov@callwork.com',
    name: 'Алексей Сидоров',
    monthlyGoal: 1500000, // 1.5 млн
  },
  {
    email: 'kuznetsova@callwork.com',
    name: 'Елена Кузнецова',
    monthlyGoal: 2000000, // 2 млн
  },
  {
    email: 'smirnov@callwork.com',
    name: 'Дмитрий Смирнов',
    monthlyGoal: 2500000, // 2.5 млн
  }
]

// Генератор случайных чисел в диапазоне
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Генератор отчёта за день с реалистичными данными
function generateDayReport(employeeIndex: number, dayOffset: number) {
  // Разная активность у разных сотрудников
  const activityMultiplier = [0.8, 1.2, 0.6, 1.0, 1.4][employeeIndex]

  // Базовые показатели с вариацией
  const zoomAppointments = Math.round(randomInt(3, 8) * activityMultiplier)
  const pzmConducted = Math.round(zoomAppointments * (randomInt(55, 70) / 100))
  const vzmConducted = Math.round(pzmConducted * (randomInt(45, 60) / 100))
  const contractReviewCount = Math.round(vzmConducted * (randomInt(35, 50) / 100))
  const pushCount = Math.round(contractReviewCount * (randomInt(55, 70) / 100))
  const successfulDeals = Math.round(pushCount * (randomInt(60, 80) / 100))

  // Сумма продаж (успешные сделки * средний чек 80-120к)
  const avgDeal = randomInt(80000, 120000)
  const monthlySalesAmount = successfulDeals * avgDeal

  // Отказы (1-3 в день)
  const refusalsCount = randomInt(1, 3)
  const refusalsByStage = {
    zoom1: randomInt(0, 1),
    zoom2: randomInt(0, 1),
    contract: randomInt(0, 1),
    push: randomInt(0, 1)
  }

  // Причины отказов
  const refusalReasons = [
    'Высокая цена',
    'Нет времени',
    'Работают с конкурентами',
    'Не подходит продукт'
  ]
  const refusalsReasons = refusalReasons[randomInt(0, refusalReasons.length - 1)]

  // Прогрев (0-2 в день)
  const warmingUpCount = randomInt(0, 2)

  return {
    zoomAppointments,
    pzmConducted,
    vzmConducted,
    contractReviewCount,
    pushCount,
    successfulDeals,
    monthlySalesAmount,
    refusalsCount,
    refusalsReasons,
    refusalsByStage,
    warmingUpCount,
    comment: dayOffset === 0 ? 'Активный день, много встреч' : null
  }
}

async function seedTestEmployees() {
  console.log('\n👥 СОЗДАНИЕ ТЕСТОВЫХ СОТРУДНИКОВ\n')
  console.log('='.repeat(80))

  try {
    // 1. Найти руководителя
    console.log('\n1️⃣  Поиск руководителя...')
    const manager = await prisma.user.findUnique({
      where: { email: 'manager@callwork.com' }
    })

    if (!manager) {
      logError('Руководитель не найден. Сначала запустите: npm run db:create-manager')
      process.exit(1)
    }

    console.log(`✅ Найден: ${manager.name} (${manager.email})`)

    // 2. Создать сотрудников
    console.log('\n2️⃣  Создание сотрудников...')
    const hashedPassword = await resolvePasswordHash({ label: 'seed password' })
    const createdEmployees = []

    for (const emp of EMPLOYEES) {
      // Проверяем существует ли уже
      const existing = await prisma.user.findUnique({
        where: { email: emp.email }
      })

      if (existing) {
        console.log(`⚠️  ${emp.name} уже существует, пропускаем`)
        createdEmployees.push(existing)
        continue
      }

      // Создаём сотрудника
      const employee = await prisma.user.create({
        data: {
          email: emp.email,
          name: emp.name,
          password: hashedPassword,
          role: 'EMPLOYEE',
          isActive: true,
          monthlyGoal: emp.monthlyGoal,
          managerId: manager.id
        }
      })

      console.log(`✅ Создан: ${employee.name} (цель: ${(employee.monthlyGoal || 0).toLocaleString()} ₽)`)
      createdEmployees.push(employee)
    }

    // 3. Создать отчёты за последние 30 дней
    console.log('\n3️⃣  Генерация отчётов за последние 30 дней...')
    let totalReports = 0

    for (let empIndex = 0; empIndex < createdEmployees.length; empIndex++) {
      const employee = createdEmployees[empIndex]
      console.log(`\n📊 Генерация отчётов для: ${employee.name}`)

      for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
        const reportDate = startOfDay(subDays(new Date(), dayOffset))

        // Проверяем существует ли отчёт
        const existingReport = await prisma.report.findUnique({
          where: {
            userId_date: {
              userId: employee.id,
              date: reportDate
            }
          }
        })

        if (existingReport) {
          continue // Пропускаем если уже есть
        }

        // Генерируем данные отчёта
        const reportData = generateDayReport(empIndex, dayOffset)

        // Создаём отчёт
        await prisma.report.create({
          data: {
            userId: employee.id,
            date: reportDate,
            ...reportData
          }
        })

        totalReports++
      }

      console.log(`✅ Создано отчётов: 30`)
    }

    console.log('\n='.repeat(80))
    console.log('\n✅ ГОТОВО!\n')
    console.log(`👥 Сотрудников: ${createdEmployees.length}`)
    console.log(`📊 Отчётов создано: ${totalReports}`)
    console.log(`\n📋 Учётные данные для входа:`)
    console.log(`   Email: {имя}@callwork.com`)
    console.log(`   Password: (set via SEED_PASSWORD)\n`)
    console.log(`📌 Все сотрудники привязаны к руководителю: ${manager.name}\n`)

    // Статистика по целям
    const totalEmployeeGoals = createdEmployees.reduce(
      (sum, emp) => sum + Number(emp.monthlyGoal || 0),
      0
    )
    console.log(`💰 Сумма целей сотрудников: ${totalEmployeeGoals.toLocaleString()} ₽`)
    console.log(`💰 Цель руководителя: ${Number(manager.monthlyGoal || 0).toLocaleString()} ₽`)
    console.log(`💰 План отдела (сумма): ${(totalEmployeeGoals + Number(manager.monthlyGoal || 0)).toLocaleString()} ₽\n`)

  } catch (error) {
    logError('Ошибка при создании данных', error)
    throw error
  }
}

async function main() {
  await seedTestEmployees()
}

main()
  .catch((error) => {
    logError('Критическая ошибка', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
