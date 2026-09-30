import type { PaginationState, Updater } from '@tanstack/react-table'
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import { PaymentRequestsTable } from './payment-requests-table'
import type { PaymentRequest } from './queries'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    ...props
  }: {
    children: React.ReactNode
    params: { paymentRequestId: string }
  }) => (
    <a {...props} href={`/payments/${params.paymentRequestId}`}>
      {children}
    </a>
  ),
}))
afterEach(cleanup)
const pending: PaymentRequest = {
  paymentRequestId: 'request-1',
  merchantId: 'shop-1',
  businessName: 'Shop',
  amount: '250.25',
  currency: 'NPR',
  description: 'Order #1028',
  status: 'PENDING',
  expiresAt: '2026-10-01T00:00:00Z',
  createdAt: '2026-09-30T00:00:00Z',
  transactionId: null,
}

it('renders a server page and keeps cancellation tied to its request', async () => {
  const onCancel = vi.fn()
  const onPaginationChange = vi.fn<(update: Updater<PaginationState>) => void>()
  const pagination = { pageIndex: 1, pageSize: 20 }
  render(
    <PaymentRequestsTable
      data={[
        pending,
        {
          ...pending,
          paymentRequestId: 'request-2',
          description: 'Paid order',
          status: 'PAID',
          transactionId: 'receipt-2',
        },
      ]}
      loading={false}
      fetching={false}
      rowCount={25}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      cancelling={false}
      onCancel={onCancel}
      onCreate={vi.fn()}
      canCreate
    />
  )
  expect(
    screen.getByRole('link', { name: 'Order #1028' }).getAttribute('href')
  ).toBe('/payments/request-1')
  expect(screen.getAllByRole('row')).toHaveLength(3)
  expect(screen.getByText('25 requests · Page 2 of 2')).toBeDefined()
  expect(
    screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')
  ).toBe(true)
  expect(
    screen.getAllByRole('button', { name: 'Cancel request' })
  ).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Receipt' })).toBeDefined()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
  expect(onCancel).toHaveBeenCalledWith('request-1')
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  const update = onPaginationChange.mock.calls[0][0]
  expect(typeof update === 'function' ? update(pagination) : update).toEqual({
    pageIndex: 0,
    pageSize: 20,
  })
})

it('offers request creation in the shared empty state', async () => {
  const onCreate = vi.fn()
  render(
    <PaymentRequestsTable
      loading={false}
      fetching={false}
      rowCount={0}
      pagination={{ pageIndex: 0, pageSize: 20 }}
      onPaginationChange={vi.fn()}
      cancelling={false}
      onCancel={vi.fn()}
      onCreate={onCreate}
      canCreate
    />
  )
  expect(screen.getByText('No payment requests')).toBeDefined()
  await userEvent.click(
    screen.getByRole('button', { name: 'New payment request' })
  )
  expect(onCreate).toHaveBeenCalledOnce()
  expect(
    screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')
  ).toBe(true)
})
