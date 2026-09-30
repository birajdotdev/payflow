import { queryOptions } from '@tanstack/react-query'

import type { User } from '@/features/auth/contracts'
import { request } from '@/lib/api'

export type Wallet = {
  walletId: string
  balance: string
  currency: string
  status: 'ACTIVE' | 'FROZEN'
  createdAt: string
  updatedAt: string
}

export type Transaction = {
  transactionId: string
  reference: string
  type: string
  status: string
  senderWalletId: string | null
  receiverWalletId: string | null
  amount: string
  currency: string
  description: string | null
  createdAt: string
  originalPaymentId?: string | null
  refundTransactionId?: string | null
  refundStatus?: string | null
  paymentRequestId?: string | null
}

export type TransactionPage = {
  content: Array<Transaction>
  totalElements: number
  page: number
  size: number
  totalPages: number
  hasNext: boolean
}

export const walletQuery = (userId: string) =>
  queryOptions({
    queryKey: ['private', userId, 'wallet'],
    queryFn: ({ signal }) => request<Wallet>('/wallet', { signal }),
  })

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ['private', userId, 'me'],
    queryFn: ({ signal }) => request<User>('/auth/me', { signal }),
  })

export const activityQuery = (userId: string) =>
  queryOptions({
    queryKey: ['private', userId, 'transactions', { page: 0, size: 5 }],
    queryFn: ({ signal }) =>
      request<TransactionPage>('/transactions', {
        signal,
        params: { page: 0, size: 5 },
      }),
  })
// Display decimal text without calculating authoritative balances or totals.

export function formatMoney(value: number | string, currency: string) {
  const [whole, fraction = ''] = String(value).split('.')

  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}
