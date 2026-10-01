// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import { ApiError } from '@/lib/api'

import { AdminScreen } from './admin-screen'

const state = vi.hoisted(() => ({
  role: 'ADMIN',
  status: 'ACTIVE',
  fail: true,
  submissions: [] as unknown[],
}))
vi.mock('@/features/auth/session', () => ({
  useSession: () => ({ user: { userId: 'admin', role: state.role } }),
}))
vi.mock('@/components/ui/toast', () => ({ toast: { add: vi.fn() } }))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  request: vi.fn(
    async (
      path: string,
      config?: { method?: string; data?: { status: string; reason: string } }
    ) => {
      const account = {
        accountId: 'customer',
        walletId: 'wallet',
        fullName: 'Customer',
        email: 'customer@example.com',
        phone: '9812345678',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-09-30T00:00:00Z',
        updatedAt: '2026-09-30T00:00:00Z',
      }
      const wallet = {
        ...account,
        accountStatus: 'ACTIVE',
        status: state.status,
        balance: '100.00',
        currency: 'NPR',
      }
      if (config?.method === 'PUT') {
        state.submissions.push(config.data)
        state.status = config.data!.status
        if (state.fail) {
          state.fail = false
          throw new ApiError('Response lost')
        }
        return wallet
      }
      if (path === '/admin/accounts')
        return { content: [account], totalElements: 1 }
      if (path === '/admin/wallets')
        return { content: [wallet], totalElements: 1 }
      return { account, wallet, audits: { content: [], totalElements: 0 } }
    }
  ),
}))
afterEach(() => {
  cleanup()
  state.role = 'ADMIN'
  state.status = 'ACTIVE'
  state.fail = true
  state.submissions = []
})
const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AdminScreen />
    </QueryClientProvider>
  )

it('keeps the original freeze transition and reason after a committed change loses its response and details refresh', async () => {
  mount()
  await userEvent.click(screen.getByRole('tab', { name: 'Wallets' }))
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'View wallet customer@example.com',
    })
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Freeze wallet' })
  )
  const confirmation = within(
    screen.getByRole('dialog', { name: 'Confirm freeze wallet' })
  )
  expect(confirmation.getByText(/customer@example.com/)).toBeTruthy()
  expect(
    confirmation.getByText(/New deposits, transfers, payments and refunds/)
  ).toBeTruthy()
  await userEvent.type(confirmation.getByLabelText('Reason'), 'Review activity')
  await userEvent.click(
    confirmation.getByRole('button', { name: 'Confirm freeze wallet' })
  )
  await confirmation.findByText('Response lost')
  expect(state.status).toBe('FROZEN')
  await userEvent.click(
    confirmation.getByRole('button', { name: 'Confirm freeze wallet' })
  )
  expect(state.submissions).toEqual([
    { status: 'FROZEN', reason: 'Review activity' },
    { status: 'FROZEN', reason: 'Review activity' },
  ])
  await screen.findByRole('button', { name: 'Unfreeze wallet' })
})
it('shows an access denied state without administrative controls for a customer', async () => {
  state.role = 'USER'
  mount()
  expect(screen.getByText('Access denied')).toBeTruthy()
  expect(screen.queryByRole('tab', { name: 'Accounts' })).toBeNull()
})
