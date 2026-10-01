import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronDown, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/data-table'
import { ErrorNotice } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/features/auth/session'
import { HistoryAdvancedFilters } from '@/features/financial/history-advanced-filters'
import { walletQuery } from '@/features/wallet/queries'
import type { TransactionPage } from '@/features/wallet/queries'
import { request } from '@/lib/api'
const routeApi = getRouteApi('/_authenticated/transactions/')
const typeItems = [
  { value: 'all', label: 'All types' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'MERCHANT_PAYMENT', label: 'Merchant payment' },
  { value: 'REFUND', label: 'Refund' },
]
const statusItems = [
  { value: 'all', label: 'All statuses' },
  { value: 'SUCCESS', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
]
function FilterSelect({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string | null) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
export function HistoryScreen() {
  const [filterReset, setFilterReset] = useState(0)
  const user = useSession().user!
  const params = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const filtered = !!(
    params.type ||
    params.status ||
    params.fromDate ||
    params.toDate ||
    params.minAmount ||
    params.maxAmount ||
    params.counterpartyWalletId
  )
  const wallet = useQuery(walletQuery(user.userId))
  const query = useQuery({
    queryKey: ['private', user.userId, 'transactions', params],
    queryFn: ({ signal }) =>
      request<TransactionPage>('/transactions', { params, signal }),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transaction history
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposits, transfers, merchant payments, and refunds with a receipt
            for each.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch()
          }}
        >
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>
      <Collapsible defaultOpen={filtered}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" />
              Filters
            </CardTitle>
            <CardDescription>
              {filtered
                ? 'Filters applied. Adjust your view below.'
                : 'Narrow your history by type, status, date, amount, or counterparty.'}
            </CardDescription>
            <CardAction>
              <CollapsibleTrigger
                render={<Button variant="outline" size="sm" />}
              >
                Filters
                <ChevronDown data-icon="inline-end" />
              </CollapsibleTrigger>
            </CardAction>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FilterSelect
                  id="transaction-type"
                  label="Type"
                  items={typeItems}
                  value={params.type ?? 'all'}
                  onChange={(value) => {
                    void navigate({
                      search: (prev) => ({
                        ...prev,
                        page: 0,
                        type:
                          value === 'DEPOSIT' ||
                          value === 'TRANSFER' ||
                          value === 'MERCHANT_PAYMENT' ||
                          value === 'REFUND'
                            ? value
                            : undefined,
                      }),
                    })
                  }}
                />
                <FilterSelect
                  id="transaction-status"
                  label="Status"
                  items={statusItems}
                  value={params.status ?? 'all'}
                  onChange={(value) => {
                    void navigate({
                      search: (prev) => ({
                        ...prev,
                        page: 0,
                        status:
                          value === 'SUCCESS' ||
                          value === 'FAILED' ||
                          value === 'PENDING'
                            ? value
                            : undefined,
                      }),
                    })
                  }}
                />
                {(['fromDate', 'toDate'] as const).map((name) => (
                  <Field key={name}>
                    <FieldLabel htmlFor={name}>
                      {name === 'fromDate' ? 'From date' : 'To date'}
                    </FieldLabel>
                    <Input
                      id={name}
                      type="datetime-local"
                      value={
                        params[name]
                          ? new Date(params[name]).toISOString().slice(0, 16)
                          : ''
                      }
                      onChange={(event) => {
                        const value = event.target.value
                        void navigate({
                          search: (prev) => ({
                            ...prev,
                            page: 0,
                            [name]: value
                              ? new Date(`${value}Z`).toISOString()
                              : undefined,
                          }),
                        })
                      }}
                    />
                    <FieldDescription>
                      {name === 'fromDate' ? 'Inclusive' : 'Exclusive'} · UTC
                    </FieldDescription>
                  </Field>
                ))}
              </FieldGroup>
              <p className="mt-3 text-sm text-muted-foreground">
                Completed includes payments that were later refunded. Choose
                Refund to see refund transactions.
              </p>
              <HistoryAdvancedFilters
                key={JSON.stringify([
                  params.minAmount,
                  params.maxAmount,
                  params.counterpartyWalletId,
                  filterReset,
                ])}
                initial={{
                  minAmount: params.minAmount ?? '',
                  maxAmount: params.maxAmount ?? '',
                  counterpartyWalletId: params.counterpartyWalletId ?? '',
                }}
                apply={(values) => {
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      page: 0,
                      minAmount: values.minAmount || undefined,
                      maxAmount: values.maxAmount || undefined,
                      counterpartyWalletId:
                        values.counterpartyWalletId || undefined,
                    }),
                  })
                }}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterReset((previous) => previous + 1)
                    void navigate({ search: { page: 0, size: params.size } })
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>All transactions</CardTitle>
            <CardDescription>Newest first · Amounts in NPR</CardDescription>
          </div>
          <div className="w-32">
            <FilterSelect
              id="page-size"
              label="Rows per page"
              items={[...new Set([5, 20, 50, 100, params.size])]
                .sort((a, b) => a - b)
                .map((value) => ({
                  value: String(value),
                  label: String(value),
                }))}
              value={String(params.size)}
              onChange={(value) => {
                if (value)
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      page: 0,
                      size: Number(value),
                    }),
                  })
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {query.error ? (
            <ErrorNotice
              error={query.error}
              retry={() => {
                void query.refetch()
              }}
            />
          ) : (
            <DataTable
              filtered={filtered}
              data={query.data?.content}
              walletId={wallet.data?.walletId}
              loading={query.isPending}
              fetching={query.isFetching}
              rowCount={query.data?.totalElements ?? 0}
              pagination={{ pageIndex: params.page, pageSize: params.size }}
              showPagination
              onPaginationChange={(updater) => {
                void navigate({
                  search: (prev) => {
                    const current = {
                      pageIndex: prev.page,
                      pageSize: prev.size,
                    }
                    const next =
                      typeof updater === 'function' ? updater(current) : updater
                    return {
                      ...prev,
                      page: next.pageIndex,
                      size: next.pageSize,
                    }
                  },
                })
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
