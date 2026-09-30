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
    type: z.enum(['DEPOSIT', 'TRANSFER']).optional().catch(undefined),
    status: z
      .enum(['SUCCESS', 'FAILED', 'PENDING'])
      .optional()
      .catch(undefined),
    fromDate: timestamp,
    toDate: timestamp,
  }),
  component: HistoryScreen,
})
