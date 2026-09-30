// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import * as operation from '@/features/financial/operation'
import { ApiError } from '@/lib/api'

import { PaymentScreen } from './payment-screen'

const id = '11111111-1111-4111-8111-111111111111'
vi.mock('@/features/auth/session', () => ({
  useSession: () => ({ user: { userId: 'customer', role: 'USER' } }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  request: vi.fn(async () => ({
    paymentRequestId: id,
    businessName: 'Demo Shop',
    amount: '250.25',
    currency: 'NPR',
    description: 'Order #1028',
    status: 'PENDING',
    expiresAt: '2026-10-01T00:00:00Z',
    transactionId: null,
  })),
}))

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

it('retains a merchant payment after a lost response and reload, then retries its original key', async () => {
  const submit = vi
    .spyOn(operation, 'submitIntent')
    .mockRejectedValueOnce(new ApiError('timeout'))
    .mockResolvedValueOnce({ transactionId: 'receipt' })

  const mount = () =>
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <PaymentScreen paymentRequestId={id} />
      </QueryClientProvider>
    )

  const view = mount()
  await screen.findByText('Demo Shop')
  expect(submit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Confirm payment' }))
  await screen.findByText('Outcome unknown')

  const original = submit.mock.calls[0][0]
  expect(original.operation).toBe('MERCHANT_PAYMENT')
  expect(original.payload).toEqual({ amount: '250.25', paymentRequestId: id })
  view.unmount()
  mount()
  await screen.findByText('Outcome unknown')
  expect(submit).toHaveBeenCalledTimes(1)
  await userEvent.click(
    screen.getByRole('button', { name: 'Retry original request' })
  )
  await screen.findByText('Payment confirmed.')
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
  expect(submit.mock.calls[1][0]).toEqual(original)
  expect(sessionStorage.length).toBe(0)
})

it('reconciles a restored merchant intent without posting another payment', async () => {
  const saved = {
    operation: 'MERCHANT_PAYMENT',
    key: 'committed',
    payload: { amount: '250.25', paymentRequestId: id },
  }
  sessionStorage.setItem(
    `payflow-intent:customer:MERCHANT_PAYMENT:${id}`,
    JSON.stringify(saved)
  )

  const submit = vi.spyOn(operation, 'submitIntent')
  vi.spyOn(operation, 'lookupIntent').mockResolvedValue({
    state: 'FOUND',
    transaction: { transactionId: 'receipt' } as NonNullable<
      operation.Outcome['transaction']
    >,
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PaymentScreen paymentRequestId={id} />
    </QueryClientProvider>
  )
  await screen.findByText('Outcome unknown')
  await userEvent.click(screen.getByRole('button', { name: 'Check outcome' }))
  await screen.findByText('Payment confirmed.')
  expect(submit).not.toHaveBeenCalled()
  expect(sessionStorage.length).toBe(0)
})
