// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import { ApiError } from '@/lib/api'

import { FundingDialog } from './funding-dialog'
import * as operation from './operation'

vi.mock('@/features/auth/session', () => ({
  useSession: () => ({ user: { userId: 'customer' } }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

it('keeps an uncertain deposit visible after dismissal and reopens recovery on reload', async () => {
  const submit = vi
    .spyOn(operation, 'submitIntent')
    .mockRejectedValue(new ApiError('Lost response'))
  const mount = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FundingDialog />
      </QueryClientProvider>
    )
  const view = mount()
  expect(screen.queryByRole('dialog')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Add demo funds' }))
  await userEvent.type(screen.getByLabelText('Amount (NPR)'), '10.25')
  await userEvent.click(screen.getByRole('button', { name: /^Add funds$/ }))
  await screen.findByText('Outcome unknown')
  await userEvent.click(screen.getByRole('button', { name: /^Close$/ }))
  await screen.findByText('Deposit outcome unknown')
  expect(submit).toHaveBeenCalledOnce()
  view.unmount()
  mount()
  await screen.findByRole('dialog', { name: 'Add demo funds' })
  await screen.findByText('Outcome unknown')
  expect(submit).toHaveBeenCalledOnce()
  expect(
    (screen.getByLabelText('Amount (NPR)') as HTMLInputElement).value
  ).toBe('10.25')
})
