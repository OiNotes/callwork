#!/usr/bin/env tsx
/**
 * Инициализация настроек РОПа (Руководителя Отдела Продаж)
 *
 * Создаёт начальные настройки с дефолтными значениями
 */

import { PrismaClient } from '@prisma/client'
import { logError } from '../lib/logger'

const prisma = new PrismaClient()

async function initRopSettings() {
  console.log('\n⚙️  ИНИЦИАЛИЗАЦИЯ НАСТРОЕК РОПа\n')
  console.log('='.repeat(80))

  try {
    // Проверяем существуют ли уже настройки
    const existing = await prisma.ropSettings.findFirst()

    if (existing) {
      console.log('⚠️  Настройки уже существуют:')
      console.log(`   ID: ${existing.id}`)
      console.log(`   Создано: ${existing.createdAt.toISOString()}`)
      console.log(`   Обновлено: ${existing.updatedAt.toISOString()}`)
      console.log('\nИспользуйте /dashboard/settings/rop для редактирования')
      return
    }

    // Создаём дефолтные настройки
    const settings = await prisma.ropSettings.create({
      data: {
        // План отдела (14 млн по умолчанию)
        departmentGoal: 14000000,

        // Дата старта периода (1-е число текущего месяца)
        periodStartDay: 1,

        // North Star KPI
        northStarTarget: 5,

        // Цели активности
        activityScoreTarget: 80,

        // Эвристика сделок
        salesPerDeal: 100000,

        // Нормы конверсий (JSON)
        conversionBenchmarks: {
          bookedToZoom1: 60,
          zoom1ToZoom2: 50,
          zoom2ToContract: 40,
          contractToPush: 60,
          pushToDeal: 70
        },

        // Пороги алертов (JSON)
        alertThresholds: {
          redZoneTolerance: 10
        },

        // Грейды мотивации (JSON)
        motivationGrades: {
          grades: [
            { minTurnover: 0, maxTurnover: 600000, commissionRate: 0 },
            { minTurnover: 600000, maxTurnover: 1000000, commissionRate: 0.05 },
            { minTurnover: 1000000, maxTurnover: 2000000, commissionRate: 0.07 },
            { minTurnover: 2000000, maxTurnover: 3500000, commissionRate: 0.08 },
            { minTurnover: 3500000, maxTurnover: 4000000, commissionRate: 0.09 },
            { minTurnover: 4000000, maxTurnover: null, commissionRate: 0.1 }
          ]
        }
      }
    })

    console.log('✅ Настройки успешно созданы!\n')
    console.log('='.repeat(80))
    console.log('\n📊 СОЗДАННЫЕ НАСТРОЙКИ:\n')
    console.log(`ID: ${settings.id}`)
    console.log(`\n💰 Финансы:`)
    console.log(`  План отдела: ${Number(settings.departmentGoal || 0).toLocaleString()} ₽`)
    console.log(`  Средний чек сделки: ${Number(settings.salesPerDeal || 0).toLocaleString()} ₽`)
    console.log(`\n📅 Период:`)
    console.log(`  Начало периода: ${settings.periodStartDay}-е число месяца`)

    type ConversionBenchmarksPayload = {
      bookedToZoom1?: number
      zoom1ToZoom2?: number
      zoom2ToContract?: number
      contractToPush?: number
      pushToDeal?: number
    }
    const benchmarks = settings.conversionBenchmarks as ConversionBenchmarksPayload | null
    console.log(`\n📈 Нормы конверсий:`)
    console.log(`  Записан → 1-й Zoom: ${benchmarks?.bookedToZoom1 || 60}%`)
    console.log(`  1-й Zoom → 2-й Zoom: ${benchmarks?.zoom1ToZoom2 || 50}%`)
    console.log(`  2-й Zoom → Договор: ${benchmarks?.zoom2ToContract || 40}%`)
    console.log(`  Договор → Дожим: ${benchmarks?.contractToPush || 60}%`)
    console.log(`  Дожим → Оплата: ${benchmarks?.pushToDeal || 70}%`)

    console.log(`\n🎯 KPI:`)
    console.log(`  North Star (1-й Zoom → Оплата): ${settings.northStarTarget}%`)
    console.log(`  Целевая активность: ${settings.activityScoreTarget}`)

    const thresholds = settings.alertThresholds as { redZoneTolerance?: number } | null
    console.log(`\n⚠️  Пороги:`)
    console.log(`  Допуск красной зоны: ${thresholds?.redZoneTolerance || 10}%`)

    console.log(`\n💼 Грейды мотивации:`)
    type MotivationGradesPayload = {
      grades?: Array<{ minTurnover: number; maxTurnover?: number | null; commissionRate: number }>
    }
    const grades = settings.motivationGrades as MotivationGradesPayload | null
    if (grades?.grades) {
      grades.grades.forEach((g, i: number) => {
        const max = g.maxTurnover ? Number(g.maxTurnover).toLocaleString() : '∞'
        console.log(`  ${i + 1}. ${Number(g.minTurnover).toLocaleString()} - ${max} ₽ → ${(g.commissionRate * 100).toFixed(0)}%`)
      })
    }

    console.log('\n='.repeat(80))
    console.log('\n✨ Теперь зайдите на /dashboard/settings/rop для настройки!\n')

  } catch (error) {
    logError('Ошибка при создании настроек', error)
    throw error
  }
}

async function main() {
  await initRopSettings()
}

main()
  .catch((error) => {
    logError('Критическая ошибка', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
