import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { ErrorNotice } from '@/components/feedback'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { useSession } from '@/features/auth/session'
import { useFinancialOperation } from '@/features/financial/use-financial-operation'
import { formatMoney, walletQuery } from '@/features/wallet/queries'
import type { Transaction } from '@/features/wallet/queries'

export function RefundAction({ payment }: { payment: Transaction }) {
  const user = useSession().user!
  const wallet = useQuery(walletQuery(user.userId))
  const operation = useFinancialOperation(false, undefined, {
    originalPaymentId: payment.transactionId,
    amount: payment.amount,
  })
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (operation.receipt) {
      setOpen(false)
      toast.add({ title: 'Refund confirmed', type: 'success' })
    }
  }, [operation.receipt])
  if (wallet.data?.walletId !== payment.receiverWalletId) return null
  return (
    <div className="flex flex-col gap-4">
      {operation.unknown && operation.intent ? (
        <Alert variant="warning" role="status">
          <AlertTitle>Outcome unknown</AlertTitle>
          <AlertDescription className="flex flex-col gap-4">
            <p>
              Your refund may have completed. The original key is preserved.
              Check its outcome or explicitly retry.
            </p>
            <p>
              Original amount:{' '}
              {formatMoney(operation.intent.payload.amount, payment.currency)}
            </p>
            <p className="break-all">
              Original recipient: {payment.senderWalletId}
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
                No committed result found yet. This does not mean the refund
                failed.
              </p>
            )}
            {operation.lookup.error && (
              <ErrorNotice inline error={operation.lookup.error} />
            )}
          </AlertDescription>
        </Alert>
      ) : (
        payment.refundStatus !== 'REFUNDED' &&
        !operation.receipt && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Refund payment
          </Button>
        )
      )}
      {operation.receipt && (
        <Alert variant="success">
          <AlertTitle>Refund confirmed</AlertTitle>
          <AlertDescription>
            The original customer has been credited.
          </AlertDescription>
        </Alert>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!operation.mutation.isPending) setOpen(value)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm full refund</DialogTitle>
            <DialogDescription>
              Return the full original amount to the original customer.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3">
            <dt>Amount</dt>
            <dd>{formatMoney(payment.amount, payment.currency)}</dd>
            <dt>Recipient wallet</dt>
            <dd className="break-all">{payment.senderWalletId}</dd>
            <dt>Payment reference</dt>
            <dd className="break-all">{payment.reference}</dd>
          </dl>
          {operation.mutation.error && (
            <ErrorNotice inline error={operation.mutation.error} />
          )}
          {operation.unknown && (
            <p role="status">
              Outcome unknown. Close this dialog to recover the original
              request.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={operation.mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={operation.locked}
              onClick={operation.confirmRefund}
            >
              {operation.mutation.isPending ? 'Refunding…' : 'Confirm refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!open && operation.mutation.error && !operation.unknown && (
        <ErrorNotice inline error={operation.mutation.error} />
      )}
    </div>
  )
}
