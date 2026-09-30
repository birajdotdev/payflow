import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  WalletCards,
} from 'lucide-react'

import { ErrorNotice } from '@/components/feedback'
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session'

import {
  activityQuery,
  formatMoney,
  profileQuery,
  walletQuery,
} from './queries'

export function WalletScreen({ overview = false }: { overview?: boolean }) {
  const user = useSession().user!
  const wallet = useQuery(walletQuery(user.userId))
  const profile = useQuery(profileQuery(user.userId))
  const activity = useQuery({
    ...activityQuery(user.userId),
    enabled: overview && wallet.isSuccess,
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            {overview ? 'YOUR OVERVIEW' : 'YOUR WALLET'}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {overview
              ? `Welcome back, ${(profile.data ?? user).fullName.split(' ')[0]}`
              : 'My wallet'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {overview
              ? 'A clear view of your money, all in one place.'
              : 'Your balance and wallet details.'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={wallet.isFetching || (overview && activity.isFetching)}
          onClick={() => {
            void wallet.refetch()
            void profile.refetch()
            if (overview) void activity.refetch()
          }}
        >
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>
      {profile.error && (
        <ErrorNotice
          error={profile.error}
          retry={() => {
            void profile.refetch()
          }}
        />
      )}
      <Card>
        <CardHeader>
          <CardDescription>Available balance</CardDescription>
          <CardTitle>
            {wallet.isPending ? (
              <Skeleton className="h-10 w-48" />
            ) : wallet.data ? (
              <span className="text-4xl tracking-tight break-all">
                {formatMoney(wallet.data.balance, wallet.data.currency)}
              </span>
            ) : (
              'Balance unavailable'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {wallet.error && (
            <ErrorNotice
              error={wallet.error}
              retry={() => {
                void wallet.refetch()
              }}
            />
          )}
          {wallet.data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{wallet.data.status}</Badge>
                <Badge variant="outline">Simulated funds</Badge>
                {wallet.isFetching && (
                  <span role="status" className="text-xs text-muted-foreground">
                    Updating…
                  </span>
                )}
              </div>
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Wallet number
                  </dt>
                  <dd className="mt-1 font-mono text-sm break-all">
                    {wallet.data.walletId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Currency</dt>
                  <dd className="mt-1 text-sm">{wallet.data.currency}</dd>
                </div>
                {!overview && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Created</dt>
                      <dd className="mt-1 text-sm">
                        {new Date(wallet.data.createdAt).toLocaleDateString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Last updated
                      </dt>
                      <dd className="mt-1 text-sm">
                        {new Date(wallet.data.updatedAt).toLocaleString()}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Demo wallet · No real money is held or moved.
          </p>
        </CardFooter>
      </Card>
      {overview && wallet.data && (
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Your five latest wallet transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activity.isPending ? (
              <div
                className="flex flex-col gap-3"
                aria-label="Loading activity"
              >
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : activity.error ? (
              <ErrorNotice
                error={activity.error}
                retry={() => {
                  void activity.refetch()
                }}
              />
            ) : activity.data.content.length ? (
              <ul className="flex flex-col divide-y">
                {activity.data.content.map((transaction) => {
                  const incoming =
                    transaction.receiverWalletId === wallet.data.walletId
                  const Icon = incoming ? ArrowDownLeft : ArrowUpRight
                  return (
                    <li
                      key={transaction.transactionId}
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {transaction.type === 'DEPOSIT'
                              ? 'Demo funds added'
                              : incoming
                                ? 'Transfer received'
                                : 'Transfer sent'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.reference} ·{' '}
                            {new Date(
                              transaction.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-sm font-medium">
                          {transaction.status === 'SUCCESS'
                            ? incoming
                              ? '+ '
                              : '− '
                            : ''}
                          {formatMoney(
                            transaction.amount,
                            transaction.currency
                          )}
                        </p>
                        <Badge variant="outline">{transaction.status}</Badge>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <WalletCards />
                  </EmptyMedia>
                  <EmptyTitle>A fresh start</EmptyTitle>
                  <EmptyDescription>
                    No transactions yet. Your wallet activity will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        Sending money and adding demo funds are coming in a later feature.
      </p>
    </div>
  )
}
