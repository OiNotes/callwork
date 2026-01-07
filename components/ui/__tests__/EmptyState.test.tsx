import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/ui/EmptyState'

const DummyIcon = <span data-testid="icon">icon</span>

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No data"
        description="Add your first entry"
        icon={DummyIcon}
      />
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Add your first entry')).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders action button', () => {
    const onAction = vi.fn()
    render(
      <EmptyState
        title="Nothing here"
        actionLabel="Create"
        onAction={onAction}
      />
    )

    const button = screen.getByRole('button', { name: /create/i })
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('renders compact variant', () => {
    const { container } = render(
      <EmptyState
        title="Compact"
        compact
      />
    )

    expect(container.firstChild).toHaveClass('py-4')
  })
})
