import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboardData } from '@/hooks/useDashboardData'

const makeResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data,
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useDashboardData', () => {
  it('loads dashboard data', async () => {
    const dashboardResponse = {
      employees: [
        {
          id: 'emp-1',
          name: 'Employee',
          role: 'EMPLOYEE',
          isActive: true,
          monthlyGoal: '2000',
          metrics: {
            zoomBooked: 1,
            pzmConducted: 1,
            vzmConducted: 1,
            contractReviewCount: 1,
            pushCount: 1,
            successfulDeals: 1,
            monthlySalesAmount: '1000',
            reportsCount: 1,
          },
          funnel: [],
        },
      ],
      teamTotals: {
        zoomBooked: 1,
        pzmConducted: 1,
        vzmConducted: 1,
        contractReviewCount: 1,
        pushCount: 1,
        successfulDeals: 1,
        monthlySalesAmount: '1000',
        totalGoal: '2000',
        goalProgress: 50,
      },
      funnel: [
        { id: 'zoomBooked', stage: 'Записи', value: 10, conversion: 100, benchmark: 100 },
        { id: 'zoom1Held', stage: 'Zoom 1', value: 8, conversion: 80, benchmark: 60 },
        { id: 'zoom2Held', stage: 'Zoom 2', value: 6, conversion: 75, benchmark: 50 },
        { id: 'contractReview', stage: 'Договор', value: 5, conversion: 83, benchmark: 40 },
        { id: 'push', stage: 'Дожим', value: 4, conversion: 80, benchmark: 60 },
        { id: 'deal', stage: 'Сделка', value: 2, conversion: 50, benchmark: 70 },
      ],
      alerts: [],
      deals: [
        {
          id: 'deal-1',
          title: 'Deal',
          budget: '1000',
          status: 'OPEN',
          paymentStatus: 'UNPAID',
          isFocus: false,
          managerId: 'emp-1',
          managerName: 'Employee',
        },
      ],
      pagination: {
        page: 1,
        limit: 50,
        total: 1,
        hasMore: false,
      },
      trend: [],
      motivation: {
        factTurnover: 1000,
        hotTurnover: 0,
        forecastTurnover: 1000,
        totalPotentialTurnover: 1000,
        factRate: 10,
        forecastRate: 20,
        salaryFact: 100,
        salaryForecast: 200,
        potentialGain: 50,
      },
      motivationGrades: [],
      settings: {
        conversionBenchmarks: {
          BOOKED_TO_ZOOM1: 60,
          ZOOM1_TO_ZOOM2: 50,
          ZOOM2_TO_CONTRACT: 40,
          CONTRACT_TO_PUSH: 60,
          PUSH_TO_DEAL: 70,
          ZOOM1_TO_DEAL_KPI: 50,
        },
        alertThresholds: {
          warning: 0.8,
          critical: 0.6,
        },
        activityTarget: 80,
        northStarTarget: 5,
        salesPerDeal: 100000,
      },
    }

    const fetchMock = vi.fn(async () => makeResponse(dashboardResponse))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(
      () =>
        useDashboardData({
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.employees).toHaveLength(1)
    expect(result.current.data?.deals).toHaveLength(1)
    expect(result.current.data?.motivationData).not.toBeNull()
  })

  it('handles fetch errors', async () => {
    const fetchMock = vi.fn(async () => makeResponse({ error: 'Fail' }, false, 500))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(
      () =>
        useDashboardData({
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
