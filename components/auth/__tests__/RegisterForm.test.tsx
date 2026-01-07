import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '@/components/auth/RegisterForm'

describe('RegisterForm', () => {
  it('blocks submit for weak password', async () => {
    const user = userEvent.setup()
    render(<RegisterForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText(/имя/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/пароль/i), 'weak')

    const submit = screen.getByRole('button', { name: /зарегистрироваться/i })
    expect(submit).toBeDisabled()
  })

  it('shows strength indicator', async () => {
    const user = userEvent.setup()
    render(<RegisterForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText(/пароль/i), 'Password123!')

    expect(screen.getByText(/сильный/i)).toBeInTheDocument()
  })
})
