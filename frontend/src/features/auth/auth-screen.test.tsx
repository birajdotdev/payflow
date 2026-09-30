// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { AuthScreen } from './auth-screen'
import { auth } from './session'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate, invalidate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mount(mode: 'register' | 'login') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <AuthScreen mode={mode} redirect="/wallet" />
    </QueryClientProvider>
  )
}
describe('auth forms', () => {
  it('validates required fields before registering', async () => {
    const register = vi.spyOn(auth, 'register')
    mount('register')
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    )
    expect(await screen.findByText('Enter your full name.')).toBeDefined()
    expect(
      screen.getByLabelText('Full name').getAttribute('aria-invalid')
    ).toBe('true')
    expect(register).not.toHaveBeenCalled()
  })
  it('submits validated registration once and directs the user to sign in', async () => {
    const register = vi.spyOn(auth, 'register').mockResolvedValue({
      userId: 'user',
      fullName: 'Test Person',
      email: 'person@example.com',
      phone: '+9779800000000',
      role: 'USER',
      walletId: 'wallet',
    })
    mount('register')
    await userEvent.type(screen.getByLabelText('Full name'), 'Test Person')
    await userEvent.type(
      screen.getByLabelText('Phone number'),
      '+9779800000000'
    )
    await userEvent.type(
      screen.getByLabelText('Email address'),
      'person@example.com'
    )
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    )
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
    expect(navigate).toHaveBeenCalledWith({
      to: '/login',
      search: { redirect: '/wallet', registered: true },
    })
  })
  it('signs in without requiring registration-only fields', async () => {
    const login = vi.spyOn(auth, 'login').mockResolvedValue()
    mount('login')
    await userEvent.type(
      screen.getByLabelText('Email address'),
      'person@example.com'
    )
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: 'person@example.com',
        password: 'password123',
      })
    )
    expect(navigate).toHaveBeenCalledWith({ to: '/wallet' })
  })
})
