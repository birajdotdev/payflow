import { queryOptions } from '@tanstack/react-query'

import type { TransactionPage } from '@/features/wallet/queries'
import { ApiError, request } from '@/lib/api'

export type Merchant = {
  merchantId: string
  businessName: string
  contactEmail: string
  contactNumber: string
  walletId: string
  status: string
  createdAt: string
}

export type PaymentRequest = {
  paymentRequestId: string
  merchantId: string
  businessName: string
  amount: string
  currency: string
  description: string | null
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  expiresAt: string
  createdAt: string
  transactionId: string | null
}

export type PaymentRequestPage = Omit<TransactionPage, 'content'> & {
  content: PaymentRequest[]
}

export const merchantQuery = (userId: string) =>
  queryOptions({
    queryKey: ['private', userId, 'merchant', 'profile'],
    queryFn: async ({ signal }) => {
      try {
        return await request<Merchant>('/merchants/me', { signal })
      } catch (error) {
        if (error instanceof ApiError && error.code === 'MERCHANT_NOT_FOUND')
          return null
        throw error
      }
    },
  })

export const paymentQuery = (userId: string, id: string) =>
  queryOptions({
    queryKey: ['private', userId, 'payments', id],
    queryFn: ({ signal }) =>
      request<PaymentRequest>(`/payments/${encodeURIComponent(id)}`, {
        signal,
      }),
  })
