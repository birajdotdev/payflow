import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { z } from 'zod'

import { ErrorNotice } from '@/components/feedback'
import {
  ServerDataTable,
  dataTableFeatures,
} from '@/components/server-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { useSession } from '@/features/auth/session'
import { formatMoney } from '@/features/wallet/queries'
import { ApiError, request } from '@/lib/api'

type Resource = 'accounts' | 'wallets'
type Account = {
  accountId: string
  walletId: string
  fullName: string
  email: string
  phone: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}
type Wallet = {
  walletId: string
  accountId: string
  fullName: string
  email: string
  accountStatus: string
  balance: string
  currency: string
  status: string
  createdAt: string
  updatedAt: string
}
type Row = Account | Wallet
type Audit = {
  id: string
  actorId: string
  targetId: string
  previousState: string
  newState: string
  reason: string
  createdAt: string
}
type Page<T> = {
  content: T[]
  totalElements: number
  page: number
  size: number
  hasNext: boolean
}
type Detail = { account: Account; wallet: Wallet; audits: Page<Audit> }
const helper = createColumnHelper<typeof dataTableFeatures, Row>()
const auditHelper = createColumnHelper<typeof dataTableFeatures, Audit>()
const emptyRows: Row[] = []
const emptyAudits: Audit[] = []
const auditColumns = auditHelper.columns([
  auditHelper.accessor('createdAt', {
    header: 'When',
    cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
  }),
  auditHelper.accessor('actorId', {
    header: 'Actor',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue()}</span>
    ),
  }),
  auditHelper.display({
    id: 'transition',
    header: 'Change',
    cell: ({ row }) =>
      `${row.original.previousState} → ${row.original.newState}`,
  }),
  auditHelper.accessor('reason', {
    header: 'Reason',
    cell: ({ getValue }) => (
      <span className="break-words whitespace-normal">{getValue()}</span>
    ),
  }),
])

function Status({ value }: { value: string }) {
  return (
    <Badge variant={value === 'ACTIVE' ? 'success' : 'warning'}>{value}</Badge>
  )
}
function NoRows({ title }: { title: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          Try a previous page or refresh the list.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
export function AdminScreen() {
  const user = useSession().user!
  if (user.role !== 'ADMIN')
    return (
      <ErrorNotice
        error={new ApiError('Administrator access is required.', 403)}
      />
    )
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Administration
        </h1>
        <p className="text-sm text-muted-foreground">
          Review accounts and wallets. Every status change requires a reason and
          is audited.
        </p>
      </div>
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <ResourceList resource="accounts" />
        </TabsContent>
        <TabsContent value="wallets">
          <ResourceList resource="wallets" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
function ResourceList({ resource }: { resource: Resource }) {
  const user = useSession().user!
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const list = useQuery({
    queryKey: ['private', user.userId, 'admin', resource, pagination],
    queryFn: ({ signal }) =>
      request<Page<Row>>(`/admin/${resource}`, {
        signal,
        params: { page: pagination.pageIndex, size: pagination.pageSize },
      }),
  })
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('fullName', {
          header: 'Owner',
          cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <span>{row.original.fullName}</span>
              <span className="text-muted-foreground">
                {row.original.email}
              </span>
            </div>
          ),
        }),
        helper.display({
          id: 'identity',
          header:
            resource === 'accounts' ? 'Account / role' : 'Wallet / balance',
          cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs">
                {resource === 'accounts'
                  ? row.original.accountId
                  : row.original.walletId}
              </span>
              <span>
                {'role' in row.original
                  ? row.original.role
                  : formatMoney(row.original.balance, row.original.currency)}
              </span>
            </div>
          ),
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: ({ getValue }) => <Status value={getValue()} />,
        }),
        helper.display({
          id: 'actions',
          header: 'Details',
          cell: ({ row }) => (
            <Button
              variant="outline"
              size="sm"
              aria-label={`View ${resource === 'accounts' ? 'account' : 'wallet'} ${row.original.email}`}
              onClick={() =>
                setSelectedId(
                  resource === 'accounts'
                    ? row.original.accountId
                    : row.original.walletId
                )
              }
            >
              View details
            </Button>
          ),
        }),
      ]),
    [resource]
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={list.isFetching}
          onClick={() => void list.refetch()}
        >
          Refresh {resource}
        </Button>
      </div>
      {list.error ? (
        <ErrorNotice error={list.error} retry={() => void list.refetch()} />
      ) : (
        <ServerDataTable
          data={list.data?.content ?? emptyRows}
          columns={columns}
          getRowId={(row) =>
            resource === 'accounts' ? row.accountId : row.walletId
          }
          loading={list.isPending}
          fetching={list.isFetching}
          rowCount={list.data?.totalElements ?? 0}
          pagination={pagination}
          onPaginationChange={setPagination}
          showPagination
          itemName={resource === 'accounts' ? 'account' : 'wallet'}
          emptyState={<NoRows title={`No ${resource} on this page`} />}
        />
      )}
      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {resource === 'accounts' ? 'Account details' : 'Wallet details'}
            </DialogTitle>
            <DialogDescription>
              Review the owner, current states and administrative history.
            </DialogDescription>
          </DialogHeader>
          {selectedId && (
            <ResourceDetail
              key={selectedId}
              resource={resource}
              id={selectedId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
function ResourceDetail({ resource, id }: { resource: Resource; id: string }) {
  const user = useSession().user!
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const detail = useQuery({
    queryKey: ['private', user.userId, 'admin', resource, id, pagination],
    queryFn: ({ signal }) =>
      request<Detail>(`/admin/${resource}/${id}`, {
        signal,
        params: { page: pagination.pageIndex, size: pagination.pageSize },
      }),
  })
  if (detail.error)
    return (
      <ErrorNotice error={detail.error} retry={() => void detail.refetch()} />
    )
  if (!detail.data) return <Spinner />
  const { account, wallet, audits } = detail.data
  const target = resource === 'accounts' ? account : wallet
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Owner</dt>
          <dd>
            {account.fullName} · {account.email}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Phone / role</dt>
          <dd>
            {account.phone} · {account.role}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Account</dt>
          <dd className="font-mono text-xs break-all">{account.accountId}</dd>
          <dd>
            <Status value={account.status} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Wallet</dt>
          <dd className="font-mono text-xs break-all">{wallet.walletId}</dd>
          <dd>
            <Status value={wallet.status} /> ·{' '}
            {formatMoney(wallet.balance, wallet.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd>{new Date(target.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Updated</dt>
          <dd>{new Date(target.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>
      {resource === 'accounts' && account.accountId === user.userId ? (
        <p className="text-sm text-muted-foreground">
          You cannot suspend your own account.
        </p>
      ) : (
        <StatusAction
          resource={resource}
          id={id}
          name={`${account.fullName} (${account.email})`}
          current={target.status}
        />
      )}
      <h2 className="font-semibold">Status audit history</h2>
      <ServerDataTable
        data={audits.content ?? emptyAudits}
        columns={auditColumns}
        getRowId={(row) => row.id}
        fetching={detail.isFetching}
        rowCount={audits.totalElements}
        pagination={pagination}
        onPaginationChange={setPagination}
        showPagination
        itemName="change"
        emptyState={<NoRows title="No status changes" />}
      />
    </div>
  )
}
function StatusAction({
  resource,
  id,
  name,
  current,
}: {
  resource: Resource
  id: string
  name: string
  current: string
}) {
  const [open, setOpen] = useState(false)
  const [intentState, setIntentState] = useState(current)
  const sourceState = open ? intentState : current
  const user = useSession().user!
  const client = useQueryClient()
  const next =
    sourceState === 'ACTIVE'
      ? resource === 'accounts'
        ? 'SUSPENDED'
        : 'FROZEN'
      : 'ACTIVE'
  const action =
    resource === 'accounts'
      ? next === 'SUSPENDED'
        ? 'Suspend account'
        : 'Reactivate account'
      : next === 'FROZEN'
        ? 'Freeze wallet'
        : 'Unfreeze wallet'
  const consequences =
    resource === 'accounts'
      ? next === 'SUSPENDED'
        ? 'All login sessions will be revoked. The owner cannot sign in or use protected APIs, and new financial operations involving this account will be blocked.'
        : 'The owner may sign in again. Old sessions remain revoked. The wallet freeze state will stay as shown.'
      : next === 'FROZEN'
        ? 'New deposits, transfers, payments and refunds involving this wallet will be blocked. The owner can still read their balance, history and committed receipts.'
        : 'Financial operations may resume if the account is active. Account suspension will stay as shown.'
  const change = useMutation({
    mutationFn: (reason: string) =>
      request(`/admin/${resource}/${id}/status`, {
        method: 'PUT',
        data: { status: next, reason: reason.trim() },
      }),
    retry: false,
    onSuccess: () => {
      setOpen(false)
      toast.add({
        title: `${action} completed`,
        type: next === 'ACTIVE' ? 'success' : 'warning',
      })
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: ['private', user.userId, 'admin'] }),
  })
  const form = useForm({
    defaultValues: { reason: '' },
    validators: {
      onSubmit: z.object({
        reason: z.string().trim().min(1, 'Enter a reason.').max(500),
      }),
    },
    onSubmit: async ({ value }) => {
      await change.mutateAsync(value.reason).catch(() => undefined)
    },
  })
  return (
    <>
      <Button
        variant={next === 'ACTIVE' ? 'outline' : 'destructive'}
        onClick={() => {
          setIntentState(current)
          form.reset()
          change.reset()
          setOpen(true)
        }}
      >
        {action}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!change.isPending) setOpen(value)
        }}
      >
        <DialogContent showCloseButton={!change.isPending}>
          <DialogHeader>
            <DialogTitle>Confirm {action.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {name}
              <br />
              {id}
              <br />
              {sourceState} → {next}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {consequences} Already committed transactions are preserved.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!change.isPending) void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field name="reason">
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor="admin-reason">Reason</FieldLabel>
                    <Textarea
                      id="admin-reason"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      aria-invalid={!field.state.meta.isValid}
                      disabled={change.isPending}
                      maxLength={500}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={change.isPending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={change.isPending}>
                  {change.isPending && <Spinner data-icon="inline-start" />}
                  Confirm {action.toLowerCase()}
                </Button>
              </div>
            </FieldGroup>
          </form>
          {change.error && <ErrorNotice error={change.error} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
