import { createFileRoute } from '@tanstack/react-router'

import { PaymentScreen } from '@/features/merchant/payment-screen'

export const Route = createFileRoute(
  '/_authenticated/payments/$paymentRequestId'
)({
  component: () => (
    <PaymentScreen paymentRequestId={Route.useParams().paymentRequestId} />
  ),
})
