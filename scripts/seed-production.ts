/**
 * seed-production.ts - Единый seed скрипт с реалистичными тестовыми данными
 *
 * Создаёт:
 * - 1 Менеджер (manager@callwork.com / password123)
 * - 5 Сотрудников с разной активностью (top/average/weak)
 * - 30 дней отчётов с реалистичной воронкой
 * - RopSettings с бенчмарками конверсии
 * - 10 сделок разных статусов
 *
 * Запуск: npx tsx scripts/seed-production.ts
 */

import { PrismaClient, Role, DealStatus, PaymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Профили сотрудников
interface EmployeeProfile {
  email: string
  name: string
  monthlyGoal: number
  type: 'top' | 'average' | 'weak'
  // Конверсии воронки
  bookedToZoom1: number    // % явки на 1-й Zoom
  zoom1ToZoom2: number     // % перехода на 2-й Zoom
  zoom2ToContract: number  // % до договора
  contractToPush: number   // % дожима
  pushToDeal: number       // % закрытия
  // Метрики активности
  dailyBooked: number      // базовое кол-во записей в день
  avgCheck: number         // средний чек
}

const EMPLOYEES: EmployeeProfile[] = [
  // TOP PERFORMERS
  {
    email: 'anna@callwork.com',
    name: 'Анна Звёздная',
    monthlyGoal: 2500000,
    type: 'top',
    bookedToZoom1: 0.85,
    zoom1ToZoom2: 0.75,
    zoom2ToContract: 0.70,
    contractToPush: 0.80,
    pushToDeal: 0.85,
    dailyBooked: 12,
    avgCheck: 58000
  },
  {
    email: 'ivan@callwork.com',
    name: 'Иван Победов',
    monthlyGoal: 2200000,
    type: 'top',
    bookedToZoom1: 0.80,
    zoom1ToZoom2: 0.70,
    zoom2ToContract: 0.65,
    contractToPush: 0.75,
    pushToDeal: 0.80,
    dailyBooked: 11,
    avgCheck: 55000
  },
  // AVERAGE PERFORMERS
  {
    email: 'maria@callwork.com',
    name: 'Мария Стабильная',
    monthlyGoal: 1800000,
    type: 'average',
    bookedToZoom1: 0.65,
    zoom1ToZoom2: 0.55,
    zoom2ToContract: 0.50,
    contractToPush: 0.65,
    pushToDeal: 0.70,
    dailyBooked: 10,
    avgCheck: 50000
  },
  {
    email: 'dmitry@callwork.com',
    name: 'Дмитрий Растущий',
    monthlyGoal: 1800000,
    type: 'average',
    bookedToZoom1: 0.60,
    zoom1ToZoom2: 0.50,
    zoom2ToContract: 0.48,
    contractToPush: 0.60,
    pushToDeal: 0.68,
    dailyBooked: 9,
    avgCheck: 48000
  },
  // WEAK PERFORMER (проблемные зоны для алертов)
  {
    email: 'alexey@callwork.com',
    name: 'Алексей Новичок',
    monthlyGoal: 1500000,
    type: 'weak',
    bookedToZoom1: 0.50,  // 🔴 низкая явка
    zoom1ToZoom2: 0.40,   // 🔴 критически низкий переход
    zoom2ToContract: 0.45,
    contractToPush: 0.55,
    pushToDeal: 0.60,
    dailyBooked: 8,
    avgCheck: 42000
  }
]

// Вариация по дням недели
function getDayMultiplier(dayOfWeek: number): number {
  switch (dayOfWeek) {
    case 1: return 1.15  // Понедельник - больше планов
    case 2: return 1.10  // Вторник
    case 3: return 1.00  // Среда - норма
    case 4: return 0.95  // Четверг
    case 5: return 0.85  // Пятница - меньше
    default: return 0    // Выходные
  }
}

// Случайная вариация ±15%
function randomVariation(base: number, variance: number = 0.15): number {
  const factor = 1 + (Math.random() * 2 - 1) * variance
  return Math.round(base * factor)
}

// Генерация отчёта для сотрудника за день
function generateReport(profile: EmployeeProfile, date: Date) {
  const dayOfWeek = date.getDay()
  const dayMultiplier = getDayMultiplier(dayOfWeek)

  if (dayMultiplier === 0) return null // Выходной

  // Базовые метрики с вариацией
  const zoomAppointments = randomVariation(profile.dailyBooked * dayMultiplier)
  const pzmConducted = Math.round(zoomAppointments * profile.bookedToZoom1 * (0.9 + Math.random() * 0.2))
  const vzmConducted = Math.round(pzmConducted * profile.zoom1ToZoom2 * (0.9 + Math.random() * 0.2))
  const contractReviewCount = Math.round(vzmConducted * profile.zoom2ToContract * (0.9 + Math.random() * 0.2))
  const pushCount = Math.round(contractReviewCount * profile.contractToPush * (0.9 + Math.random() * 0.2))
  const successfulDeals = Math.round(pushCount * profile.pushToDeal * (0.9 + Math.random() * 0.2))

  // Сумма продаж
  const monthlySalesAmount = successfulDeals * randomVariation(profile.avgCheck, 0.20)

  // Отказы (обратно пропорционально успеху)
  const refusalsCount = Math.max(0, Math.round((zoomAppointments - successfulDeals) * 0.3 * Math.random()))

  // Прогрев
  const warmingUpCount = randomVariation(5, 0.5)

  return {
    date,
    zoomAppointments: Math.max(0, zoomAppointments),
    pzmConducted: Math.max(0, pzmConducted),
    vzmConducted: Math.max(0, vzmConducted),
    contractReviewCount: Math.max(0, contractReviewCount),
    pushCount: Math.max(0, pushCount),
    successfulDeals: Math.max(0, successfulDeals),
    monthlySalesAmount: Math.max(0, monthlySalesAmount), // Prisma примет number
    refusalsCount,
    warmingUpCount,
    refusalsReasons: refusalsCount > 0 ? getRandomRefusalReasons(refusalsCount) : null
  }
}

function getRandomRefusalReasons(count: number): string {
  const reasons = [
    'Дорого',
    'Нужно подумать',
    'Не сейчас',
    'Выбирает между конкурентами',
    'Не устроили условия',
    'Передумал',
    'Нет бюджета'
  ]
  const selected = []
  for (let i = 0; i < Math.min(count, 3); i++) {
    selected.push(reasons[Math.floor(Math.random() * reasons.length)])
  }
  return selected.join(', ')
}

// Генерация сделок
function generateDeals(managerId: string, employeeIds: string[]) {
  const dealTemplates = [
    // OPEN deals
    { title: 'Корпоративное обучение IT-компании', budget: 450000, status: DealStatus.OPEN, paymentStatus: PaymentStatus.UNPAID, isFocus: true },
    { title: 'Консалтинг для стартапа', budget: 180000, status: DealStatus.OPEN, paymentStatus: PaymentStatus.UNPAID, isFocus: false },
    { title: 'Программа развития лидерства', budget: 320000, status: DealStatus.OPEN, paymentStatus: PaymentStatus.UNPAID, isFocus: true },
    { title: 'Тренинг по продажам', budget: 250000, status: DealStatus.OPEN, paymentStatus: PaymentStatus.PARTIAL, isFocus: false },
    { title: 'Коучинг для топ-менеджмента', budget: 580000, status: DealStatus.OPEN, paymentStatus: PaymentStatus.UNPAID, isFocus: true },
    // WON deals
    { title: 'Командный тренинг банка', budget: 420000, status: DealStatus.WON, paymentStatus: PaymentStatus.PAID, isFocus: false },
    { title: 'Программа онбординга', budget: 280000, status: DealStatus.WON, paymentStatus: PaymentStatus.PAID, isFocus: false },
    { title: 'Стратегическая сессия', budget: 150000, status: DealStatus.WON, paymentStatus: PaymentStatus.PARTIAL, isFocus: false },
    // LOST deals
    { title: 'Тренинг для ритейла', budget: 200000, status: DealStatus.LOST, paymentStatus: PaymentStatus.UNPAID, isFocus: false },
    { title: 'Корпоративный университет', budget: 750000, status: DealStatus.LOST, paymentStatus: PaymentStatus.UNPAID, isFocus: false },
  ]

  return dealTemplates.map((deal, index) => ({
    ...deal,
    budget: deal.budget, // Prisma примет number
    managerId: employeeIds[index % employeeIds.length], // Распределяем по сотрудникам
    closedAt: deal.status !== DealStatus.OPEN ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
    paidAt: deal.paymentStatus === PaymentStatus.PAID ? new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000) : null,
  }))
}

async function main() {
  console.log('🧹 Очистка базы данных...')

  // Удаляем в правильном порядке (из-за foreign keys)
  await prisma.alert.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.report.deleteMany()
  await prisma.ropSettings.deleteMany()
  await prisma.motivationGrade.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ База очищена')

  // 1. Создаём менеджера
  console.log('\n👔 Создаю менеджера...')
  const hashedPassword = await bcrypt.hash('password123', 10)

  const manager = await prisma.user.create({
    data: {
      email: 'manager@callwork.com',
      name: 'Руководитель отдела',
      password: hashedPassword,
      role: Role.MANAGER,
      isActive: true,
      monthlyGoal: 10000000 // 10 млн (сумма целей команды)
    }
  })
  console.log(`✅ Менеджер создан: ${manager.email}`)

  // 2. Создаём сотрудников
  console.log('\n👥 Создаю сотрудников...')
  const employees = []

  for (const profile of EMPLOYEES) {
    const employee = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        password: hashedPassword, // Тот же пароль для простоты
        role: Role.EMPLOYEE,
        isActive: true,
        monthlyGoal: profile.monthlyGoal, // Prisma примет number
        managerId: manager.id
      }
    })
    employees.push({ ...employee, profile })
    console.log(`  ✅ ${profile.type.toUpperCase()}: ${profile.name} (${profile.email}) - цель: ${(profile.monthlyGoal / 1000000).toFixed(1)}М`)
  }

  // 3. Создаём отчёты за последние 30 дней
  console.log('\n📊 Создаю отчёты за 30 дней...')
  const today = new Date()
  let totalReports = 0

  for (const emp of employees) {
    let employeeReports = 0

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(12, 0, 0, 0) // Полдень

      const reportData = generateReport(emp.profile, date)
      if (!reportData) continue // Пропускаем выходные

      await prisma.report.create({
        data: {
          userId: emp.id,
          ...reportData
        }
      })
      employeeReports++
    }

    totalReports += employeeReports
    console.log(`  📈 ${emp.profile.name}: ${employeeReports} отчётов`)
  }
  console.log(`✅ Создано ${totalReports} отчётов`)

  // 4. Создаём RopSettings
  console.log('\n⚙️ Создаю настройки ROP...')
  await prisma.ropSettings.create({
    data: {
      managerId: manager.id,
      departmentGoal: 14000000, // Prisma примет number
      northStarTarget: 5,
      activityScoreTarget: 80,
      periodStartDay: 1,
      salesPerDeal: 100000, // Prisma примет number
      conversionBenchmarks: {
        bookedToZoom1: 60,
        zoom1ToZoom2: 50,
        zoom2ToContract: 40,
        contractToPush: 60,
        pushToDeal: 70
      },
      alertThresholds: {
        noReportsDays: 2,
        lowConversionPercent: 30,
        noDealsDays: 5,
        behindPacePercent: 20
      },
      motivationGrades: {
        grades: [
          { minTurnover: 0, maxTurnover: 600000, commissionRate: 0 },
          { minTurnover: 600000, maxTurnover: 1000000, commissionRate: 0.05 },
          { minTurnover: 1000000, maxTurnover: 2000000, commissionRate: 0.07 },
          { minTurnover: 2000000, maxTurnover: 3500000, commissionRate: 0.08 },
          { minTurnover: 3500000, maxTurnover: null, commissionRate: 0.10 }
        ]
      }
    }
  })
  console.log('✅ RopSettings созданы')

  // 5. Создаём сделки
  console.log('\n💼 Создаю сделки...')
  const employeeIds = employees.map(e => e.id)
  const deals = generateDeals(manager.id, employeeIds)

  for (const deal of deals) {
    await prisma.deal.create({ data: deal })
  }
  console.log(`✅ Создано ${deals.length} сделок (5 OPEN, 3 WON, 2 LOST)`)

  // 6. Итоговая статистика
  console.log('\n' + '='.repeat(50))
  console.log('📋 ИТОГОВАЯ СТАТИСТИКА:')
  console.log('='.repeat(50))

  const stats = await prisma.report.aggregate({
    _sum: { monthlySalesAmount: true, successfulDeals: true },
    _count: true
  })

  console.log(`👔 Менеджер: manager@callwork.com / password123`)
  console.log(`👥 Сотрудников: ${employees.length}`)
  console.log(`📊 Отчётов: ${stats._count}`)
  console.log(`💰 Общая выручка: ${Number(stats._sum.monthlySalesAmount || 0).toLocaleString('ru-RU')} ₽`)
  console.log(`✅ Сделок закрыто: ${stats._sum.successfulDeals || 0}`)
  console.log(`💼 Сделок в системе: ${deals.length}`)
  console.log('='.repeat(50))
  console.log('\n🎉 Seed завершён успешно!')
  console.log('\n📌 Для входа используйте:')
  console.log('   Email: manager@callwork.com')
  console.log('   Пароль: password123')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
