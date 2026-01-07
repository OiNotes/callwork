import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FunnelChart } from '@/components/analytics/FunnelChart'

const sampleData = [
  {
    id: 'zoom',
    label: 'Zoom',
    value: 10,
    conversion: 100,
    benchmark: 100,
    isRedZone: false
  },
  {
    id: 'deal',
    label: 'Deal',
    value: 5,
    conversion: 50,
    benchmark: 60,
    isRedZone: false
  }
]

describe('FunnelChart', () => {
  it('renders funnel stages', () => {
    render(<FunnelChart data={sampleData} />)

    expect(screen.getByText('Zoom')).toBeInTheDocument()
    expect(screen.getByText('Deal')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<FunnelChart data={[]} />)

    expect(screen.getByText(/нет данных для воронки/i)).toBeInTheDocument()
  })

  it('shows error state with retry', () => {
    const onRetry = vi.fn()
    render(<FunnelChart data={sampleData} error="Ошибка" onRetry={onRetry} />)

    expect(screen.getByText('Ошибка')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /повторить/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
