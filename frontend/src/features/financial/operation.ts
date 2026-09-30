import { z } from 'zod'

import type { Transaction } from '@/features/wallet/queries'
import { ApiError, request } from '@/lib/api'

export const amountSchema = (maximum: number) =>
  z
    .string()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      'Use a positive amount with at most two decimal places.'
    )
    .refine(
      (value) => Number(value) > 0 && Number(value) <= maximum,
      `Amount must be between 0.01 and ${maximum}.`
    )
export const financialSchema = z.object({
  amount: amountSchema(1000000),
  receiverWalletId: z.string(),
  description: z.string().max(255),
})
export type Intent = {
  operation: 'DEPOSIT' | 'TRANSFER'
  key: string
  payload: { amount: string; receiverWalletId?: string; description?: string }
}
export type Outcome = {
  state: 'FOUND' | 'UNKNOWN'
  transaction: Transaction | null
}
export const submitIntent = (intent: Intent) =>
  request<{ transactionId: string }>(
    intent.operation === 'DEPOSIT' ? '/wallet/deposit' : '/transfers',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': intent.key },
      data: intent.payload,
    }
  )
export const lookupIntent = (intent: Intent) =>
  request<Outcome>('/transactions/outcome', {
    params: { operation: intent.operation, key: intent.key },
  })
export function ambiguous(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    error.status === undefined ||
    error.status >= 500 ||
    error.code === 'INVALID_RESPONSE'
  )
}

export const savedIntentSchema = z.object({
  operation: z.enum(['DEPOSIT', 'TRANSFER']),
  key: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  payload: z.object({
    amount: amountSchema(1000000),
    receiverWalletId: z.uuid().optional(),
    description: z.string().max(255).optional(),
  }),
})
