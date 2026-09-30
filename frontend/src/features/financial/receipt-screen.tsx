import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ReceiptText } from 'lucide-react'

import { ErrorNotice } from '@/components/feedback'
import { TransactionStatus } from '@/components/transaction-status'
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
import { Skeleton } from '@/components/ui/skeleton'
import { WalletId } from '@/components/wallet-id'
import { useSession } from '@/features/auth/session'
import { formatMoney } from '@/features/wallet/queries'
import type { Transaction } from '@/features/wallet/queries'
import { request } from '@/lib/api'
export function ReceiptScreen({ transactionId }: { transactionId: string }) {
  const user = useSession().user!
  const query = useQuery({
    queryKey: ['private', user.userId, 'transactions', transactionId],
    queryFn: ({ signal }) =>
      request<Transaction>(
        `/transactions/${encodeURIComponent(transactionId)}`,
        { signal }
      ),
  })
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link to="/transactions" search={{ page: 0, size: 20 }} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to history
        </Button>
      </div>
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <ReceiptText className="size-6" />
          </span>
          <CardTitle>Transaction receipt</CardTitle>
          <CardDescription>
            Your confirmed transaction record from PayFlow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {query.isPending ? (
            <div aria-label="Loading receipt" className="flex flex-col gap-4">
              <Skeleton className="mx-auto h-10 w-48" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : query.error ? (
            <ErrorNotice
              error={query.error}
              retry={() => {
                void query.refetch()
              }}
            />
          ) : (
            <>
              <div className="flex flex-col items-center gap-3">
                <p className="text-3xl font-semibold tabular-nums">
                  {formatMoney(query.data.amount, query.data.currency)}
                </p>
                <TransactionStatus status={query.data.status} />
              </div>
              <Separator />
              <dl className="grid gap-5 sm:grid-cols-2">
                {Object.entries({
                  Reference: query.data.reference,
                  Type:
                    query.data.type === 'DEPOSIT'
                      ? 'Demo deposit'
                      : 'Wallet transfer',
                  Sender: query.data.senderWalletId ?? 'Demo funding',
                  Recipient: query.data.receiverWalletId,
                  Description: query.data.description ?? '—',
                  Created: new Date(query.data.createdAt).toLocaleString(),
                  'Transaction ID': query.data.transactionId,
                }).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm break-all">
                      {(label === 'Sender' && query.data.senderWalletId) ||
                      (label === 'Recipient' && query.data.receiverWalletId) ? (
                        <WalletId value={value!} label={`${label} wallet ID`} />
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted-foreground">
          Simulated funds · No real money was moved
        </CardFooter>
      </Card>
    </div>
  )
}
