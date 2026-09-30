import { Link } from '@tanstack/react-router'
import { createColumnHelper } from '@tanstack/react-table'
import type { OnChangeFn, PaginationState } from '@tanstack/react-table'
import {
  CircleCheck,
  CircleX,
  Clock3,
  Link2,
  Plus,
  TimerOff,
} from 'lucide-react'
import { useMemo } from 'react'

import {
  ServerDataTable,
  dataTableFeatures,
} from '@/components/server-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ReceiptDialog } from '@/features/financial/receipt-dialog'
import { formatMoney } from '@/features/wallet/queries'

import type { PaymentRequest } from './queries'
import { SharePaymentLink } from './share-payment-link'

const helper = createColumnHelper<typeof dataTableFeatures, PaymentRequest>()
const emptyRows: PaymentRequest[] = []
const statusIcons = {
  PENDING: Clock3,
  PAID: CircleCheck,
  CANCELLED: CircleX,
  EXPIRED: TimerOff,
}

export function PaymentRequestsTable({
  data = emptyRows,
  loading,
  fetching,
  rowCount,
  pagination,
  onPaginationChange,
  cancelling,
  onCancel,
  onCreate,
  canCreate,
}: {
  data?: PaymentRequest[]
  loading: boolean
  fetching: boolean
  rowCount: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  cancelling: boolean
  onCancel: (id: string) => void
  onCreate: () => void
  canCreate: boolean
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('description', {
          header: 'Request',
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Link2 className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <Link
                  to="/payments/$paymentRequestId"
                  params={{ paymentRequestId: row.original.paymentRequestId }}
                  className="max-w-56 truncate font-medium hover:underline"
                  title={row.original.description ?? undefined}
                >
                  {row.original.description || 'Payment request'}
                </Link>
                <span
                  className="max-w-44 truncate font-mono text-xs text-muted-foreground"
                  title={row.original.paymentRequestId}
                >
                  {row.original.paymentRequestId}
                </span>
              </div>
            </div>
          ),
        }),
        helper.accessor('expiresAt', {
          header: 'Expires',
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
          cell: ({ getValue }) => {
            const status = getValue()
            const Icon = statusIcons[status]
            return (
              <Badge variant="outline">
                <Icon />
                {status}
              </Badge>
            )
          },
        }),
        helper.accessor('amount', {
          header: 'Amount',
          cell: ({ row }) => (
            <span className="font-medium tabular-nums">
              {formatMoney(row.original.amount, row.original.currency)}
            </span>
          ),
        }),
        helper.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <SharePaymentLink id={row.original.paymentRequestId} />
              {row.original.transactionId && (
                <ReceiptDialog
                  transactionId={row.original.transactionId}
                  trigger={
                    <Button size="sm" variant="outline">
                      Receipt
                    </Button>
                  }
                />
              )}
              {row.original.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => onCancel(row.original.paymentRequestId)}
                >
                  Cancel request
                </Button>
              )}
            </div>
          ),
        }),
      ]),
    [cancelling, onCancel]
  )

  return (
    <ServerDataTable
      data={data}
      columns={columns}
      getRowId={(row) => row.paymentRequestId}
      loading={loading}
      fetching={fetching}
      rowCount={rowCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      showPagination
      itemName="request"
      emptyState={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2 />
            </EmptyMedia>
            <EmptyTitle>No payment requests</EmptyTitle>
            <EmptyDescription>
              Create your first payment link to start receiving payments.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onCreate} disabled={!canCreate}>
              <Plus data-icon="inline-start" />
              New payment request
            </Button>
          </EmptyContent>
        </Empty>
      }
    />
  )
}
