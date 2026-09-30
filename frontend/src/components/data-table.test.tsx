import type { PaginationState, Updater } from '@tanstack/react-table'
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import type { Transaction } from '@/features/wallet/queries'

import { DataTable } from './data-table'
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: React.ReactNode
    to: string
    params: { transactionId: string }
  }) => (
    <a {...props} href={to.replace('$transactionId', params.transactionId)}>
      {children}
    </a>
  ),
}))
afterEach(cleanup)
const transaction: Transaction = {
  transactionId: 'receipt-1',
  reference: 'PF-123',
  type: 'TRANSFER',
  status: 'SUCCESS',
  senderWalletId: 'alice',
  receiverWalletId: 'bob',
  amount: '99999999999999999.99',
  currency: 'NPR',
  description: 'Dinner',
  createdAt: '2026-09-30T05:00:00Z',
}
it('renders a server page without slicing again and advances controlled pagination', async () => {
  const pagination = { pageIndex: 1, pageSize: 5 }
  const change = vi.fn<(updater: Updater<PaginationState>) => void>()
  render(
    <DataTable
      data={[transaction]}
      walletId="alice"
      rowCount={12}
      pagination={pagination}
      showPagination
      onPaginationChange={change}
    />
  )
  expect(screen.getByText('PF-123')).toBeDefined()
  expect(screen.getByText('− NPR 99,999,999,999,999,999.99')).toBeDefined()
  expect(screen.getByText('Completed')).toBeDefined()
  expect(
    screen.getByLabelText('View receipt PF-123').getAttribute('href')
  ).toBe('/transactions/receipt-1')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  const updater = change.mock.calls[0][0]
  expect(typeof updater === 'function' ? updater(pagination) : updater).toEqual(
    { pageIndex: 2, pageSize: 5 }
  )
})
it('shows a useful empty state and disables pagination for no rows', () => {
  render(<DataTable rowCount={0} showPagination />)
  expect(screen.getByText('No transactions yet')).toBeDefined()
  expect(
    screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')
  ).toBe(true)
  expect(
    screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')
  ).toBe(true)
})
