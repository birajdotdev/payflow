import { createFileRoute } from '@tanstack/react-router'

import { ReceiptScreen } from '@/features/financial/receipt-screen'
export const Route = createFileRoute(
  '/_authenticated/transactions/$transactionId'
)({ component: Receipt })
function Receipt() {
  const { transactionId } = Route.useParams()
  return <ReceiptScreen transactionId={transactionId} />
}
