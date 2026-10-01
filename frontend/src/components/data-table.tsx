import { Link } from '@tanstack/react-router'
// PayFlow adaptation of shadcn dashboard-01's TanStack Table v9 data table.
import { createColumnHelper } from '@tanstack/react-table'
import type { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react'
import { useMemo } from 'react'

import {
  ServerDataTable,
  dataTableFeatures,
} from '@/components/server-data-table'
import { TransactionStatus } from '@/components/transaction-status'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ReceiptDialog } from '@/features/financial/receipt-dialog'
import { formatMoney } from '@/features/wallet/queries'
import type { Transaction } from '@/features/wallet/queries'
const features = dataTableFeatures
const helper = createColumnHelper<typeof features, Transaction>()
const emptyRows: Transaction[] = []
export function DataTable({
  data = emptyRows,
  walletId,
  loading = false,
  rowCount = data.length,
  pagination = { pageIndex: 0, pageSize: 5 },
  onPaginationChange,
  showPagination = false,
  fetching = false,
  filtered = false,
}: {
  data?: Transaction[]
  walletId?: string
  loading?: boolean
  rowCount?: number
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  showPagination?: boolean
  filtered?: boolean
  fetching?: boolean
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('reference', {
          header: 'Transaction',
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {row.original.receiverWalletId === walletId ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>
              <div className="flex flex-col gap-1">
                <Link
                  to="/transactions/$transactionId"
                  params={{ transactionId: row.original.transactionId }}
                  className="font-medium hover:underline"
                >
                  {row.original.type === 'REFUND'
                    ? row.original.receiverWalletId === walletId
                      ? 'Refund received'
                      : 'Refund sent'
                    : row.original.type === 'DEPOSIT'
                      ? 'Demo funds added'
                      : row.original.type === 'MERCHANT_PAYMENT'
                        ? row.original.receiverWalletId === walletId
                          ? 'Merchant payment received'
                          : 'Merchant payment sent'
                        : row.original.receiverWalletId === walletId
                          ? 'Transfer received'
                          : 'Transfer sent'}
                </Link>
                <span
                  className="max-w-44 truncate font-mono text-xs text-muted-foreground"
                  title={row.original.reference}
                >
                  {row.original.reference}
                </span>
              </div>
            </div>
          ),
        }),
        helper.accessor('createdAt', {
          header: 'Date',
          cell: ({ getValue }) => (
            <span className="text-muted-foreground">
              {new Date(getValue()).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ),
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: ({ row }) => (
            <TransactionStatus
              status={
                row.original.refundStatus === 'REFUNDED'
                  ? 'REFUNDED'
                  : row.original.status
              }
            />
          ),
        }),
        helper.accessor('amount', {
          header: 'Amount',
          cell: ({ row }) => (
            <span className="font-medium tabular-nums">
              {row.original.status === 'SUCCESS' && walletId
                ? row.original.receiverWalletId === walletId
                  ? '+ '
                  : '− '
                : ''}
              {formatMoney(row.original.amount, row.original.currency)}
            </span>
          ),
        }),
        helper.display({
          id: 'receipt',
          header: () => <span className="sr-only">Receipt</span>,
          cell: ({ row }) => (
            <ReceiptDialog
              transactionId={row.original.transactionId}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`View receipt ${row.original.reference}`}
                >
                  <ReceiptText />
                </Button>
              }
            />
          ),
        }),
      ]),
    [walletId]
  )
  return (
    <ServerDataTable
      data={data}
      columns={columns}
      getRowId={(row) => row.transactionId}
      loading={loading}
      fetching={fetching}
      rowCount={rowCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      showPagination={showPagination}
      itemName="transaction"
      emptyState={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText />
            </EmptyMedia>
            <EmptyTitle>
              {filtered ? 'No matching transactions' : 'No transactions yet'}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Try adjusting or clearing your filters.'
                : 'Your wallet activity will appear here.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  )
}
