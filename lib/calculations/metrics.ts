import { CONVERSION_BENCHMARKS, FUNNEL_STAGES, KPI_BENCHMARKS } from '@/lib/config/metrics'
import type { FunnelStageId } from '@/lib/config/conversionBenchmarks'

export interface StageConversion {
  id: FunnelStageId
  value: number
  from: number
  conversion: number
  benchmark: number
  isRedZone: boolean
}

export interface ConversionTotals {
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  push: number
  deals: number
}

export interface ConversionsResult {
  stages: StageConversion[]
  northStar: number
  totalConversion: number
}

const round2 = (num: number) => Math.round(num * 100) / 100
const safeRate = (value: number, base: number) => (base > 0 ? round2((value / base) * 100) : 0)

export function computeConversions(totals: ConversionTotals): ConversionsResult {
  const pairs: Array<{ id: FunnelStageId; prevId: FunnelStageId; benchmark: number }> = [
    { id: 'zoom1Held', prevId: 'zoomBooked', benchmark: CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1 },
    { id: 'zoom2Held', prevId: 'zoom1Held', benchmark: CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2 },
    { id: 'contractReview', prevId: 'zoom2Held', benchmark: CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT },
    { id: 'push', prevId: 'contractReview', benchmark: CONVERSION_BENCHMARKS.CONTRACT_TO_PUSH },
    { id: 'deal', prevId: 'push', benchmark: CONVERSION_BENCHMARKS.PUSH_TO_DEAL },
  ]

  const stageMap: Record<FunnelStageId, number> = {
    zoomBooked: totals.zoomBooked || 0,
    zoom1Held: totals.zoom1Held || 0,
    zoom2Held: totals.zoom2Held || 0,
    contractReview: totals.contractReview || 0,
    push: totals.push || 0,
    deal: totals.deals || 0,
  }

  const stages: StageConversion[] = [
    {
      id: 'zoomBooked',
      value: stageMap.zoomBooked,
      from: stageMap.zoomBooked,
      conversion: 100,
      benchmark: 100,
      isRedZone: false,
    },
    ...pairs.map(({ id, prevId, benchmark }) => {
      const conversion = safeRate(stageMap[id], stageMap[prevId])
      return {
        id,
        value: stageMap[id],
        from: stageMap[prevId],
        conversion,
        benchmark,
        isRedZone: conversion < benchmark,
      }
    }),
  ]

  const northStar = safeRate(stageMap.deal, stageMap.zoom1Held || stageMap.zoomBooked)
  const totalConversion = safeRate(stageMap.deal, stageMap.zoomBooked)

  return { stages, northStar, totalConversion }
}

export function stageBenchmarkById(id: FunnelStageId): number {
  switch (id) {
    case 'zoomBooked':
      return 100
    case 'zoom1Held':
      return CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1
    case 'zoom2Held':
      return CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2
    case 'contractReview':
      return CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT
    case 'push':
      return CONVERSION_BENCHMARKS.CONTRACT_TO_PUSH
    case 'deal':
      return CONVERSION_BENCHMARKS.PUSH_TO_DEAL
    default:
      return 100
  }
}

export function resolveNorthStarStatus(value: number) {
  return {
    target: KPI_BENCHMARKS.NORTH_STAR,
    delta: round2(value - KPI_BENCHMARKS.NORTH_STAR),
    isOnTrack: value >= KPI_BENCHMARKS.NORTH_STAR,
  }
}

export function getStageLabel(id: FunnelStageId): string {
  const meta = FUNNEL_STAGES.find((stage) => stage.id === id)
  return meta?.label ?? id
}
