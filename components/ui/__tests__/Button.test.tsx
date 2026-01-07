import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Submit</Button>)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading spinner', () => {
    render(<Button loading>Loading</Button>)
    const button = screen.getByRole('button', { name: /loading/i })
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>)
    const button = screen.getByRole('button', { name: /loading/i })
    expect(button).toBeDisabled()
  })
})
