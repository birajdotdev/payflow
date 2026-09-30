import { Link } from '@tanstack/react-router'
// PayFlow adaptation of shadcn dashboard-01's TanStack Table v9 data table.
import {
  createColumnHelper,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react'
import { useMemo } from 'react'

import { TransactionStatus } from '@/components/transaction-status'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMoney } from '@/features/wallet/queries'
import type { Transaction } from '@/features/wallet/queries'
const features = tableFeatures({ rowPaginationFeature })
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
}: {
  data?: Transaction[]
  walletId?: string
  loading?: boolean
  rowCount?: number
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  showPagination?: boolean
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
                  {row.original.type === 'DEPOSIT'
                    ? 'Demo funds added'
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
          cell: ({ getValue }) => <TransactionStatus status={getValue()} />,
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
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={
                <Link
                  to="/transactions/$transactionId"
                  params={{ transactionId: row.original.transactionId }}
                />
              }
              aria-label={`View receipt ${row.original.reference}`}
            >
              <ReceiptText />
            </Button>
          ),
        }),
      ]),
    [walletId]
  )
  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => row.transactionId,
    manualPagination: true,
    rowCount,
    autoResetPageIndex: false,
    state: { pagination },
    onPaginationChange,
  })
  return (
    <div className="flex flex-col gap-4">
      <div
        className="overflow-hidden rounded-lg border"
        aria-busy={loading || fetching}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.id === 'amount' ? 'text-right' : undefined
                    }
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {columns.map((_, column) => (
                    <TableCell key={column}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === 'amount' ? 'text-right' : undefined
                      }
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ReceiptText />
                      </EmptyMedia>
                      <EmptyTitle>No transactions yet</EmptyTitle>
                      <EmptyDescription>
                        Your deposits and transfers will appear here. If filters
                        are applied, try a different view.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showPagination && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rowCount} {rowCount === 1 ? 'transaction' : 'transactions'} · Page{' '}
            {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            {fetching ? ' · Updating…' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage() || fetching}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage() || fetching}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
