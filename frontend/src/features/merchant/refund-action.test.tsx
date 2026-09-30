// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import * as operation from '@/features/financial/operation'
import type { Transaction } from '@/features/wallet/queries'
import { ApiError } from '@/lib/api'

import { RefundAction } from './refund-action'

const id = '11111111-1111-4111-8111-111111111111'
const wallet = '22222222-2222-4222-8222-222222222222'
const recipient = '33333333-3333-4333-8333-333333333333'
vi.mock('@/features/auth/session', () => ({
  useSession: () => ({ user: { userId: 'merchant', role: 'MERCHANT' } }),
}))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  request: vi.fn(async () => ({ walletId: wallet })),
}))
const payment: Transaction = {
  transactionId: id,
  reference: 'PF-payment',
  type: 'MERCHANT_PAYMENT',
  status: 'SUCCESS',
  senderWalletId: recipient,
  receiverWalletId: wallet,
  amount: '250.25',
  currency: 'NPR',
  description: null,
  createdAt: '2026-09-30T00:00:00Z',
}
const mount = (record = payment) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RefundAction payment={record} />
    </QueryClientProvider>
  )
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.restoreAllMocks()
})
it('requires confirmation showing original amount and recipient, then preserves a lost response across remount and retries exactly', async () => {
  const submit = vi
    .spyOn(operation, 'submitIntent')
    .mockRejectedValueOnce(new ApiError('timeout'))
    .mockResolvedValueOnce({ transactionId: 'refund' })
  const view = mount()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Refund payment' })
  )
  const dialog = screen.getByRole('dialog', { name: 'Confirm full refund' })
  expect(within(dialog).getByText('NPR 250.25')).toBeTruthy()
  expect(within(dialog).getByText(recipient)).toBeTruthy()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(submit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Refund payment' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirm refund' }))
  await screen.findByText('Outcome unknown')
  const saved = submit.mock.calls[0][0]
  expect(saved.operation).toBe('REFUND')
  expect(saved.payload).toEqual({ amount: '250.25', originalPaymentId: id })
  view.unmount()
  mount({ ...payment, refundStatus: 'REFUNDED' })
  await screen.findByText('Outcome unknown')
  expect(submit).toHaveBeenCalledTimes(1)
  await userEvent.click(
    screen.getByRole('button', { name: 'Retry original request' })
  )
  await screen.findByText('Refund confirmed')
  expect(submit.mock.calls[1][0]).toEqual(saved)
  expect(sessionStorage.length).toBe(0)
})
it('reconciles a restored refund through a read without a financial POST', async () => {
  sessionStorage.setItem(
    `payflow-intent:merchant:REFUND:${id}`,
    JSON.stringify({
      operation: 'REFUND',
      key: 'original',
      payload: { amount: '250.25', originalPaymentId: id },
    })
  )
  const submit = vi.spyOn(operation, 'submitIntent')
  vi.spyOn(operation, 'lookupIntent').mockResolvedValue({
    state: 'FOUND',
    transaction: { ...payment, transactionId: 'refund' },
  })
  mount({ ...payment, refundStatus: 'REFUNDED' })
  await userEvent.click(
    await screen.findByRole('button', { name: 'Check outcome' })
  )
  await screen.findByText('Refund confirmed')
  expect(submit).not.toHaveBeenCalled()
  expect(sessionStorage.length).toBe(0)
})
