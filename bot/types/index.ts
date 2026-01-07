export interface ReportState {
  step: string
  date: Date
  data: Partial<ReportData>
  lastReport?: Partial<ReportData>
  overwriteConfirmed?: boolean
  updatedAt: number
  ttlMs?: number
}

export interface ReportData {
  zoomAppointments: number
  pzmConducted: number
  refusalsCount: number
  refusalsReasons?: string
  warmingUpCount: number
  vzmConducted: number
  contractReviewCount: number
  pushCount: number
  successfulDeals: number
  monthlySalesAmount: string
}

export type SessionState = 'awaiting_code' | ReportState
