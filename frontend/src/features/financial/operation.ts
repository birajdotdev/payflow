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
  operation: 'DEPOSIT' | 'TRANSFER' | 'MERCHANT_PAYMENT' | 'REFUND'
  key: string
  payload: {
    amount: string
    receiverWalletId?: string
    description?: string
    paymentRequestId?: string
    originalPaymentId?: string
  }
}

export type Outcome = {
  state: 'FOUND' | 'UNKNOWN'
  transaction: Transaction | null
}

export const submitIntent = async (intent: Intent) => {
  const result = await request<{ transactionId: string }>(
    intent.operation === 'DEPOSIT'
      ? '/wallet/deposit'
      : intent.operation === 'TRANSFER'
        ? '/transfers'
        : intent.operation === 'REFUND'
          ? `/merchants/payments/${encodeURIComponent(intent.payload.originalPaymentId!)}/refund`
          : `/payments/${encodeURIComponent(intent.payload.paymentRequestId!)}/pay`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': intent.key },
      data:
        intent.operation === 'MERCHANT_PAYMENT' || intent.operation === 'REFUND'
          ? undefined
          : intent.payload,
    }
  )

  if (!result || !z.uuid().safeParse(result.transactionId).success)
    throw new ApiError(
      'PayFlow returned an invalid receipt.',
      200,
      'INVALID_RESPONSE'
    )

  return result
}

export const lookupIntent = async (intent: Intent) => {
  const outcome = await request<Outcome>('/transactions/outcome', {
    params: { operation: intent.operation, key: intent.key },
  })

  const valid = z
    .object({
      state: z.enum(['FOUND', 'UNKNOWN']),
      transaction: z.object({ transactionId: z.uuid() }).nullable(),
    })
    .safeParse(outcome)

  if (
    !valid.success ||
    (outcome.state === 'FOUND') !== (outcome.transaction !== null)
  )
    throw new ApiError(
      'PayFlow returned an invalid outcome.',
      200,
      'INVALID_RESPONSE'
    )

  return outcome
}

export function ambiguous(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    error.status === undefined ||
    error.status >= 500 ||
    error.code === 'INVALID_RESPONSE'
  )
}

export const savedIntentSchema = z
  .object({
    operation: z.enum(['DEPOSIT', 'TRANSFER', 'MERCHANT_PAYMENT', 'REFUND']),
    key: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    payload: z.object({
      amount: amountSchema(1000000),
      receiverWalletId: z.uuid().optional(),
      description: z.string().max(255).optional(),
      paymentRequestId: z.uuid().optional(),
      originalPaymentId: z.uuid().optional(),
    }),
  })
  .refine(
    (intent) =>
      intent.operation !== 'MERCHANT_PAYMENT' ||
      !!intent.payload.paymentRequestId
  )
  .refine(
    (intent) =>
      intent.operation !== 'REFUND' || !!intent.payload.originalPaymentId
  )
