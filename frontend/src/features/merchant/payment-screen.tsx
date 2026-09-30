import { useQuery } from '@tanstack/react-query'
import { CircleHelp, CircleCheck, Store, ShieldCheck } from 'lucide-react'

import { ErrorNotice, PagePending } from '@/components/feedback'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/features/auth/session'
import { ReceiptDialog } from '@/features/financial/receipt-dialog'
import { useFinancialOperation } from '@/features/financial/use-financial-operation'
import { formatMoney } from '@/features/wallet/queries'

import { paymentQuery } from './queries'
import type { PaymentRequest } from './queries'

export function PaymentScreen({
  paymentRequestId,
}: {
  paymentRequestId: string
}) {
  const user = useSession().user!

  const query = useQuery(paymentQuery(user.userId, paymentRequestId))

  if (query.isPending) return <PagePending />

  if (query.error)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )

  return (
    <PaymentReview
      key={paymentRequestId}
      payment={query.data}
      refresh={() => {
        void query.refetch()
      }}
    />
  )
}

function PaymentReview({
  payment,
  refresh,
}: {
  payment: PaymentRequest
  refresh: () => void
}) {
  const user = useSession().user!

  const operation = useFinancialOperation(false, {
    paymentRequestId: payment.paymentRequestId,
    amount: payment.amount,
  })

  const receipt = operation.receipt ?? payment.transactionId

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Store aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Pay merchant</h1>
        <p className="text-sm text-muted-foreground">
          A payment to {payment.businessName}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{payment.businessName}</CardTitle>
          <CardDescription>
            Review this payment before confirming. The amount comes from the
            merchant’s request.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Badge variant="outline" className="w-fit">
            {receipt ? 'PAID' : payment.status}
          </Badge>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatMoney(payment.amount, payment.currency)}
          </p>
          <Separator />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 text-sm">
            <dt>Order</dt>
            <dd className="break-words">{payment.description || '—'}</dd>
            <dt>Fee</dt>
            <dd>NPR 0.00</dd>
            <dt>Total</dt>
            <dd>{formatMoney(payment.amount, payment.currency)}</dd>
            <dt>Expires</dt>
            <dd>{new Date(payment.expiresAt).toLocaleString()}</dd>
            <dt>Request ID</dt>
            <dd className="break-all">{payment.paymentRequestId}</dd>
          </dl>
          {operation.unknown && operation.intent ? (
            <Alert variant="warning" role="status">
              <CircleHelp />
              <AlertTitle>Outcome unknown</AlertTitle>
              <AlertDescription className="flex flex-col gap-4">
                <p>
                  Your payment may have completed. Check its outcome or retry
                  the original request safely.
                </p>
                <p>
                  Original amount:{' '}
                  {formatMoney(operation.intent.payload.amount, 'NPR')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      operation.mutation.isPending || operation.lookup.isPending
                    }
                    onClick={() => operation.lookup.mutate(operation.intent!)}
                  >
                    Check outcome
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      operation.mutation.isPending || operation.lookup.isPending
                    }
                    onClick={operation.retryOriginal}
                  >
                    Retry original request
                  </Button>
                </div>
                {operation.lookup.data?.state === 'UNKNOWN' && (
                  <p>
                    No committed result found yet. This does not mean the
                    payment failed.
                  </p>
                )}
                {operation.lookup.error && (
                  <ErrorNotice inline error={operation.lookup.error} />
                )}
                <details>
                  <summary>Request details</summary>
                  <p className="break-all">
                    Operation key: {operation.intent.key}
                  </p>
                </details>
              </AlertDescription>
            </Alert>
          ) : receipt ? (
            <Alert variant="success" role="status">
              <CircleCheck />
              <AlertTitle>Payment confirmed.</AlertTitle>
              <AlertDescription>
                <p>Your merchant payment is recorded.</p>
                <div className="mt-3">
                  <ReceiptDialog transactionId={receipt} />
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-4">
              {payment.status === 'PENDING' && user.role !== 'ADMIN' ? (
                <Button
                  size="lg"
                  disabled={operation.locked}
                  onClick={operation.confirmPayment}
                >
                  {operation.mutation.isPending && (
                    <Spinner data-icon="inline-start" />
                  )}
                  Confirm payment
                </Button>
              ) : (
                <p role="status">
                  {payment.status === 'PAID'
                    ? 'This request has already been paid.'
                    : payment.status === 'PENDING'
                      ? 'Use a customer or merchant account to pay.'
                      : `This request is ${payment.status.toLowerCase()}.`}
                </p>
              )}
              {operation.mutation.error && (
                <ErrorNotice inline error={operation.mutation.error} />
              )}
            </div>
          )}
          <Button variant="outline" onClick={refresh}>
            Refresh payment status
          </Button>
        </CardContent>
        <CardFooter className="justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck />
          Simulated funds · No real money is moved
        </CardFooter>
      </Card>
    </div>
  )
}
