import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Plus, RefreshCw } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import { ErrorNotice } from '@/components/feedback'
import { SectionCards } from '@/components/section-cards'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session'
import { FundingScreen } from '@/features/financial/funding-screen'

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
    enabled: overview,
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {overview
              ? `Welcome back, ${(profile.data ?? user).fullName.split(' ')[0]}`
              : 'My wallet'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview
              ? 'Your wallet and recent activity, at a glance.'
              : 'Your balance, wallet details, and demo funding.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          {overview && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/wallet" />}
            >
              <Plus data-icon="inline-start" />
              Add funds
            </Button>
          )}
          <Button nativeButton={false} render={<Link to="/send" />}>
            <ArrowUpRight data-icon="inline-start" />
            Send money
          </Button>
        </div>
      </div>
      {profile.error && (
        <ErrorNotice
          error={profile.error}
          retry={() => {
            void profile.refetch()
          }}
        />
      )}
      {wallet.error && (
        <ErrorNotice
          error={wallet.error}
          retry={() => {
            void wallet.refetch()
          }}
        />
      )}
      {overview ? (
        <>
          <SectionCards
            wallet={wallet.data}
            transactionCount={activity.data?.totalElements}
          />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Recent transactions</CardTitle>
                <CardDescription>
                  Your latest five deposits and transfers.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link to="/transactions" search={{ page: 0, size: 20 }} />
                }
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {activity.error ? (
                <ErrorNotice
                  error={activity.error}
                  retry={() => {
                    void activity.refetch()
                  }}
                />
              ) : (
                <DataTable
                  data={activity.data?.content}
                  walletId={wallet.data?.walletId}
                  loading={activity.isPending}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your wallet number</CardTitle>
              <CardDescription>
                Share this number to receive a transfer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm break-all">
                {wallet.data?.walletId ?? 'Loading…'}
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Available balance</CardDescription>
              <CardTitle>
                {wallet.data ? (
                  <span className="text-3xl tabular-nums">
                    {formatMoney(wallet.data.balance, wallet.data.currency)}
                  </span>
                ) : (
                  <Skeleton className="h-9 w-40" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {wallet.data && (
                <>
                  <Badge variant="secondary" className="w-fit">
                    {wallet.data.status}
                  </Badge>
                  <dl className="grid gap-5">
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        Wallet number
                      </dt>
                      <dd className="mt-1 font-mono text-sm break-all">
                        {wallet.data.walletId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        Currency
                      </dt>
                      <dd className="mt-1">{wallet.data.currency}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Created</dt>
                      <dd className="mt-1 text-sm">
                        {new Date(wallet.data.createdAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Demo wallet · No real money is held or moved.
            </CardFooter>
          </Card>
          <FundingScreen />
        </div>
      )}
    </div>
  )
}
