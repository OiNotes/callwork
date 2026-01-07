import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/LoginForm'

describe('LoginForm', () => {
  it('renders form fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument()
  })

  it('shows email validation error', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={vi.fn()} />)

    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'invalid')
    fireEvent.blur(emailInput)

    expect(screen.getByText(/введите корректный email/i)).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows password validation error', () => {
    render(<LoginForm onSubmit={vi.fn()} />)

    const passwordInput = screen.getByLabelText(/пароль/i)
    fireEvent.blur(passwordInput)

    expect(screen.getByText(/введите пароль/i)).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits with valid data', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/пароль/i), 'Password123!')

    fireEvent.submit(screen.getByRole('button', { name: /войти/i }))
    expect(onSubmit).toHaveBeenCalledWith('user@example.com', 'Password123!')
  })

  it('shows auth error message', () => {
    render(<LoginForm onSubmit={vi.fn()} errorMessage="Invalid credentials" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
  })

  it('sets aria-invalid for invalid fields on submit', () => {
    render(<LoginForm onSubmit={vi.fn()} />)

    fireEvent.submit(screen.getByRole('button', { name: /войти/i }))

    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/пароль/i)).toHaveAttribute('aria-invalid', 'true')
  })
})
