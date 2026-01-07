/**
 * Dashboard Types
 * Extracted from DashboardContent.tsx to eliminate `any` types
 */

// Re-export types from funnel.client to maintain compatibility
export type { FunnelStage, ManagerStats } from '@/lib/analytics/funnel.client'

// User types
export interface DashboardUser {
  id: string
  name: string
  email: string
  role: 'MANAGER' | 'EMPLOYEE' | 'ADMIN'
}

// Report from API
export interface EmployeeReport {
  id: string
  date: string | Date
  monthlySalesAmount: number | string
  successfulDeals: number
  zoomBooked?: number
  zoom1Held?: number
  zoom2Held?: number
  contractReview?: number
  pushCount?: number
  refusals?: number
  warming?: number
}

// Employee data from API
export interface EmployeeData {
  id: string
  name: string
  email?: string
  role?: 'MANAGER' | 'EMPLOYEE' | 'ADMIN'
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  pushCount: number
  successfulDeals: number
  salesAmount: number
  planSales: number
  planDeals: number
  refusals: number
  warming: number
  reports?: EmployeeReport[]
  // Conversion rates (calculated)
  bookedToZoom1?: number
  zoom1ToZoom2?: number
  zoom2ToContract?: number
  contractToPush?: number
  pushToDeal?: number
  northStar?: number
  totalConversion?: number
  activityScore?: number
  trend?: 'up' | 'down' | 'flat'
}

// Team stats from API
export interface TeamStats {
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  pushCount: number
  successfulDeals: number
  salesAmount: number
  planSales: number
  planDeals: number
  refusals: number
  warming: number
  // Conversion rates
  bookedToZoom1: number
  zoom1ToZoom2: number
  zoom2ToContract: number
  contractToPush: number
  pushToDeal: number
  northStar: number
  totalConversion: number
  activityScore: number
  trend: 'up' | 'flat' | 'down'
}

// Trend data point
export interface TrendDataPoint {
  date: string
  sales: number
  deals: number
}

// Alert from red zone analysis
export interface DashboardAlert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  managerName?: string
}

// Date range
export interface DateRange {
  start: Date
  end: Date
}

// Props
export interface DashboardContentProps {
  user: DashboardUser
}
