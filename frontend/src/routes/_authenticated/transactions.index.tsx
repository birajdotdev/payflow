import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { HistoryScreen } from '@/features/financial/history-screen'
const timestamp = z
  .string()
  .datetime({ offset: true })
  .optional()
  .catch(undefined)
export const Route = createFileRoute('/_authenticated/transactions/')({
  validateSearch: z.object({
    page: z.coerce.number().int().min(0).max(1000000).catch(0),
    size: z.coerce.number().int().min(1).max(100).catch(20),
    type: z
      .enum(['DEPOSIT', 'TRANSFER', 'MERCHANT_PAYMENT', 'REFUND'])
      .optional()
      .catch(undefined),
    status: z
      .enum(['SUCCESS', 'FAILED', 'PENDING'])
      .optional()
      .catch(undefined),
    minAmount: z.preprocess(
      (value) => (typeof value === 'number' ? String(value) : value),
      z.string().max(32).optional()
    ),
    maxAmount: z.preprocess(
      (value) => (typeof value === 'number' ? String(value) : value),
      z.string().max(32).optional()
    ),
    counterpartyWalletId: z.string().max(64).optional(),
    fromDate: timestamp,
    toDate: timestamp,
  }),
  component: HistoryScreen,
})
