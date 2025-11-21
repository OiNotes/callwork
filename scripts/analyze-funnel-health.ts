#!/usr/bin/env tsx

/**
 * Анализ здоровья воронки продаж
 *
 * Проверяет конверсии на каждом этапе воронки и находит "красные зоны"
 *
 * Usage:
 *   npx tsx scripts/analyze-funnel-health.ts
 *   npx tsx scripts/analyze-funnel-health.ts --detailed
 *   npx tsx scripts/analyze-funnel-health.ts --critical-only
 */

import { prisma } from '@/lib/prisma'
import { CONVERSION_BENCHMARKS } from '@/lib/config/conversionBenchmarks'

interface FunnelMetrics {
  userId: string
  userName: string
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  pushCount: number
  successfulDeals: number
  conversions: {
    bookedToZoom1: number
    zoom1ToZoom2: number
    zoom2ToContract: number
    contractToPush: number
    pushToDeal: number
    northStar: number
  }
  redZones: RedZone[]
}

interface RedZone {
  stage: string
  current: number
  benchmark: number
  gap: number
  severity: 'CRITICAL' | 'WARNING'
  impact: string
}

const args = process.argv.slice(2)
const isDetailed = args.includes('--detailed')
const criticalOnly = args.includes('--critical-only')

function calculateConversions(metrics: any) {
  const safeDiv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

  return {
    bookedToZoom1: safeDiv(metrics.zoom1Held, metrics.zoomBooked),
    zoom1ToZoom2: safeDiv(metrics.zoom2Held, metrics.zoom1Held),
    zoom2ToContract: safeDiv(metrics.contractReview, metrics.zoom2Held),
    contractToPush: safeDiv(metrics.pushCount, metrics.contractReview),
    pushToDeal: safeDiv(metrics.successfulDeals, metrics.pushCount),
    northStar: safeDiv(metrics.successfulDeals, metrics.zoom1Held),
  }
}

function findRedZones(conversions: any): RedZone[] {
  const issues: RedZone[] = []

  const checks = [
    {
      stage: 'Booked → Zoom1',
      current: conversions.bookedToZoom1,
      benchmark: CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1,
      critical: false,
      impact: 'No-show и переносы'
    },
    {
      stage: 'Zoom1 → Zoom2',
      current: conversions.zoom1ToZoom2,
      benchmark: CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2,
      critical: true,
      impact: 'Теряем клиентов после первой встречи'
    },
    {
      stage: 'Zoom2 → Contract',
      current: conversions.zoom2ToContract,
      benchmark: CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT,
      critical: false,
      impact: 'Проблемы с ценностным предложением'
    },
    {
      stage: 'Contract → Push',
      current: conversions.contractToPush,
      benchmark: CONVERSION_BENCHMARKS.CONTRACT_TO_PUSH,
      critical: false,
      impact: 'Долгое согласование'
    },
    {
      stage: 'Push → Deal',
      current: conversions.pushToDeal,
      benchmark: CONVERSION_BENCHMARKS.PUSH_TO_DEAL,
      critical: true,
      impact: 'Слабый follow-up'
    },
    {
      stage: 'North Star',
      current: conversions.northStar,
      benchmark: CONVERSION_BENCHMARKS.NORTH_STAR,
      critical: true,
      impact: 'Общая эффективность воронки'
    }
  ]

  checks.forEach(check => {
    if (check.current < check.benchmark) {
      issues.push({
        stage: check.stage,
        current: check.current,
        benchmark: check.benchmark,
        gap: check.benchmark - check.current,
        severity: check.critical ? 'CRITICAL' : 'WARNING',
        impact: check.impact
      })
    }
  })

  return issues.sort((a, b) => b.gap - a.gap)
}

async function analyzeEmployee(userId: string, startDate: Date, endDate: Date): Promise<FunnelMetrics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  })

  const reports = await prisma.report.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate }
    }
  })

  const totals = reports.reduce((acc, r) => ({
    zoomBooked: acc.zoomBooked + r.zoomAppointments,
    zoom1Held: acc.zoom1Held + r.pzmConducted,
    zoom2Held: acc.zoom2Held + r.vzmConducted,
    contractReview: acc.contractReview + r.contractReviewCount,
    pushCount: acc.pushCount + (r.pushCount || 0),
    successfulDeals: acc.successfulDeals + r.successfulDeals,
  }), {
    zoomBooked: 0,
    zoom1Held: 0,
    zoom2Held: 0,
    contractReview: 0,
    pushCount: 0,
    successfulDeals: 0
  })

  const conversions = calculateConversions(totals)
  const redZones = findRedZones(conversions)

  return {
    userId,
    userName: user?.name || 'Unknown',
    ...totals,
    conversions,
    redZones
  }
}

async function calculateHealthScore(metrics: FunnelMetrics): Promise<number> {
  const weights = {
    bookedToZoom1: 10,
    zoom1ToZoom2: 25, // критично
    zoom2ToContract: 15,
    contractToPush: 10,
    pushToDeal: 25, // критично
    northStar: 15
  }

  let score = 0
  let totalWeight = 0

  Object.entries(weights).forEach(([key, weight]) => {
    const current = metrics.conversions[key as keyof typeof metrics.conversions]
    const benchmark = CONVERSION_BENCHMARKS[key.toUpperCase().replace(/([A-Z])/g, '_$1') as keyof typeof CONVERSION_BENCHMARKS]

    if (benchmark) {
      const ratio = Math.min(current / benchmark, 1.5) // cap at 150%
      score += ratio * weight
      totalWeight += weight
    }
  })

  return Math.round((score / totalWeight) * 100)
}

async function main() {
  console.log('🏥 Анализ здоровья воронки продаж\n')

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  console.log(`Период: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`)

  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      isActive: true
    },
    select: { id: true }
  })

  const results: FunnelMetrics[] = []

  for (const emp of employees) {
    const metrics = await analyzeEmployee(emp.id, startDate, endDate)
    results.push(metrics)
  }

  // Сортировка по количеству красных зон
  results.sort((a, b) => b.redZones.length - a.redZones.length)

  // Вывод результатов
  console.log('='.repeat(80))
  console.log('РЕЗУЛЬТАТЫ АНАЛИЗА')
  console.log('='.repeat(80) + '\n')

  for (const result of results) {
    if (criticalOnly && result.redZones.length === 0) continue

    const healthScore = await calculateHealthScore(result)
    const statusIcon = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🔴'

    console.log(`${statusIcon} ${result.userName} (Health Score: ${healthScore}/100)`)

    if (result.redZones.length > 0) {
      console.log(`   🔴 Красных зон: ${result.redZones.length}`)
      result.redZones.forEach((rz, i) => {
        const icon = rz.severity === 'CRITICAL' ? '⚠️' : '⚠️'
        console.log(`   ${i + 1}. ${icon} ${rz.stage}: ${rz.current}% (норма ${rz.benchmark}%) -${rz.gap}%`)
        if (isDetailed) {
          console.log(`      Impact: ${rz.impact}`)
        }
      })
    } else {
      console.log('   ✅ Все показатели в норме')
    }

    if (isDetailed) {
      console.log(`\n   Детальные конверсии:`)
      console.log(`   - Booked → Zoom1:     ${result.conversions.bookedToZoom1}%`)
      console.log(`   - Zoom1 → Zoom2:      ${result.conversions.zoom1ToZoom2}%`)
      console.log(`   - Zoom2 → Contract:   ${result.conversions.zoom2ToContract}%`)
      console.log(`   - Contract → Push:    ${result.conversions.contractToPush}%`)
      console.log(`   - Push → Deal:        ${result.conversions.pushToDeal}%`)
      console.log(`   - North Star:         ${result.conversions.northStar}%`)
    }

    console.log('')
  }

  // Сводная статистика
  console.log('='.repeat(80))
  const totalRedZones = results.reduce((sum, r) => sum + r.redZones.length, 0)
  const criticalIssues = results.reduce((sum, r) => sum + r.redZones.filter(rz => rz.severity === 'CRITICAL').length, 0)

  console.log(`ИТОГО: ${totalRedZones} красных зон, из них ${criticalIssues} критических`)
  console.log('='.repeat(80) + '\n')

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('❌ Ошибка при анализе:', error)
  process.exit(1)
})
