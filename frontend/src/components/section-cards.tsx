// Real wallet data in the summary-card layout from shadcn dashboard-01.
import { WalletCards, Globe, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/features/wallet/queries'
import type { Wallet } from '@/features/wallet/queries'
export function SectionCards({
  wallet,
  transactionCount,
}: {
  wallet?: Wallet
  transactionCount?: number
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>Available balance</CardDescription>
          <CardTitle>
            {wallet ? (
              <span className="text-3xl tabular-nums">
                {formatMoney(wallet.balance, wallet.currency)}
              </span>
            ) : (
              <Skeleton className="h-9 w-40" />
            )}
          </CardTitle>
          <CardAction>
            <WalletCards className="size-5 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardFooter>
          <Badge variant="secondary">{wallet?.status ?? 'Loading'}</Badge>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Wallet currency</CardDescription>
          <CardTitle>
            <span className="text-3xl">{wallet?.currency ?? 'NPR'}</span>
          </CardTitle>
          <CardAction>
            <Globe className="size-5 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          Simulated funds for your everyday workflow
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Total transactions</CardDescription>
          <CardTitle>
            {transactionCount !== undefined ? (
              <span className="text-3xl tabular-nums">{transactionCount}</span>
            ) : (
              <Skeleton className="h-9 w-16" />
            )}
          </CardTitle>
          <CardAction>
            <ReceiptText className="size-5 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          Deposits and transfers in your wallet
        </CardFooter>
      </Card>
    </div>
  )
}
