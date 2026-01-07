import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

class MockEventSource {
  static instances: MockEventSource[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  close = vi.fn()

  constructor(public url: string) {
    MockEventSource.instances.push(this)
  }
}

const makeResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data
})

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ActivityFeed', () => {
  it('renders activities', async () => {
    const activity = {
      id: 'a1',
      type: 'report',
      message: 'Report submitted',
      details: 'Zoom: 5',
      timestamp: new Date().toISOString(),
      userId: 'u1',
      userName: 'User'
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeResponse({ data: [activity], pagination: { hasNext: false } })
    ))

    render(<ActivityFeed />)

    expect(await screen.findByText('Report submitted')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeResponse({ data: [], pagination: { hasNext: false } })
    ))

    render(<ActivityFeed />)

    expect(await screen.findByText(/нет активностей/i)).toBeInTheDocument()
  })

  it('loads more activities', async () => {
    const activity1 = {
      id: 'a1',
      type: 'report',
      message: 'First',
      timestamp: new Date().toISOString(),
      userId: 'u1',
      userName: 'User'
    }
    const activity2 = {
      id: 'a2',
      type: 'deal',
      message: 'Second',
      timestamp: new Date().toISOString(),
      userId: 'u1',
      userName: 'User'
    }

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse({ data: [activity1], pagination: { hasNext: true } }))
      .mockResolvedValueOnce(makeResponse({ data: [activity2], pagination: { hasNext: false } }))

    vi.stubGlobal('fetch', fetchMock)

    render(<ActivityFeed />)

    expect(await screen.findByText('First')).toBeInTheDocument()

    const loadMore = screen.getByRole('button', { name: /показать ещё/i })
    fireEvent.click(loadMore)

    expect(await screen.findByText('Second')).toBeInTheDocument()
  })
})
