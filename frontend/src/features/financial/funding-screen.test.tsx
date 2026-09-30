// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import { ApiError } from '@/lib/api'

import { FundingScreen } from './funding-screen'
import * as operation from './operation'
vi.mock('@/features/auth/session', () => ({
  useSession: () => ({ user: { userId: 'alice' } }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
afterEach(() => {
  sessionStorage.clear()
  cleanup()
  vi.restoreAllMocks()
})
it('preserves an ambiguous request across navigation and explicitly retries the same payload and key', async () => {
  const submit = vi
    .spyOn(operation, 'submitIntent')
    .mockRejectedValueOnce(new ApiError('timeout'))
    .mockResolvedValueOnce({ transactionId: 'receipt' })
  const lookup = vi
    .spyOn(operation, 'lookupIntent')
    .mockResolvedValue({ state: 'UNKNOWN', transaction: null })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const mount = () =>
    render(
      <QueryClientProvider client={client}>
        <FundingScreen />
      </QueryClientProvider>
    )
  const view = mount()
  await userEvent.type(screen.getByLabelText('Amount (NPR)'), '10.25')
  await userEvent.click(screen.getByRole('button', { name: 'Add funds' }))
  await screen.findByText(/Outcome unknown/)
  expect(submit).toHaveBeenCalledTimes(1)
  const original = submit.mock.calls[0][0]
  view.unmount()
  client.clear()
  mount()
  await screen.findByText(/Outcome unknown/)
  await userEvent.click(screen.getByRole('button', { name: 'Check outcome' }))
  await screen.findByText(/No committed result/)
  expect(lookup).toHaveBeenCalledWith(original, expect.anything())
  expect(submit).toHaveBeenCalledTimes(1)
  await userEvent.click(
    screen.getByRole('button', { name: 'Retry original request' })
  )
  await screen.findByText('Operation confirmed.')
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
  expect(submit.mock.calls[1][0]).toEqual(original)
  expect(original.payload).toEqual({ amount: '10.25' })
})

it('reconciles a restored intent without replaying the financial request', async () => {
  sessionStorage.setItem(
    'payflow-intent:alice:DEPOSIT',
    JSON.stringify({
      operation: 'DEPOSIT',
      key: 'committed-deposit',
      payload: { amount: '10.25' },
    })
  )
  const submit = vi.spyOn(operation, 'submitIntent')
  vi.spyOn(operation, 'lookupIntent').mockResolvedValue({
    state: 'FOUND',
    transaction: {
      transactionId: 'receipt',
    } as NonNullable<operation.Outcome['transaction']>,
  })
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <FundingScreen />
    </QueryClientProvider>
  )
  await screen.findByText('Outcome unknown')
  await userEvent.click(screen.getByRole('button', { name: 'Check outcome' }))
  await screen.findByText('Operation confirmed.')
  expect(submit).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('payflow-intent:alice:DEPOSIT')).toBeNull()
})

it('reviews validated transfer details, supports edits, and sends only after confirmation', async () => {
  const submit = vi
    .spyOn(operation, 'submitIntent')
    .mockResolvedValue({ transactionId: 'receipt' })
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <FundingScreen transfer />
    </QueryClientProvider>
  )
  await userEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
  expect(submit).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Confirm transfer' })).toBeNull()
  const wallet = '11111111-1111-4111-8111-111111111111'
  await userEvent.type(screen.getByLabelText('Amount (NPR)'), '10.25')
  await userEvent.type(screen.getByLabelText('Recipient wallet number'), wallet)
  await userEvent.type(screen.getByLabelText('Description (optional)'), 'Lunch')
  await userEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
  const review = await screen.findByRole('region', { name: 'Transfer review' })
  expect(review.textContent).toContain(wallet)
  expect(review.textContent).toContain('FeeNPR 0.00')
  expect(review.textContent).toContain('TotalNPR 10.25')
  expect(submit).not.toHaveBeenCalled()
  expect(sessionStorage.length).toBe(0)
  await userEvent.click(screen.getByRole('button', { name: 'Edit transfer' }))
  await userEvent.clear(screen.getByLabelText('Amount (NPR)'))
  await userEvent.type(screen.getByLabelText('Amount (NPR)'), '12.50')
  await userEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirm transfer' })
  )
  await screen.findByText('Operation confirmed.')
  expect(submit).toHaveBeenCalledTimes(1)
  expect(submit.mock.calls[0][0].payload).toEqual({
    amount: '12.50',
    receiverWalletId: wallet,
    description: 'Lunch',
  })
})
