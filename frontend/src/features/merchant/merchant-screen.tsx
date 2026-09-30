import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { DataTable } from '@/components/data-table'
import { ErrorNotice, PagePending } from '@/components/feedback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { auth, useSession } from '@/features/auth/session'
import { amountSchema } from '@/features/financial/operation'
import { formatMoney, walletQuery } from '@/features/wallet/queries'
import type { TransactionPage } from '@/features/wallet/queries'
import { request } from '@/lib/api'

import { merchantQuery } from './queries'
import type { Merchant, PaymentRequest, PaymentRequestPage } from './queries'

export function MerchantScreen() {
  const user = useSession().user!

  const profile = useQuery(merchantQuery(user.userId))

  if (profile.isPending) return <PagePending />

  if (profile.error)
    return (
      <ErrorNotice
        error={profile.error}
        retry={() => {
          void profile.refetch()
        }}
      />
    )

  if (!profile.data) return <Enrollment />

  if (user.role !== 'MERCHANT')
    return (
      <Card>
        <CardHeader>
          <CardTitle>Merchant access</CardTitle>
          <CardDescription>
            Refresh your account role to open the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RefreshRole />
        </CardContent>
      </Card>
    )

  return <Dashboard merchant={profile.data} />
}

function RefreshRole() {
  const refresh = useMutation({
    mutationFn: () => auth.revalidateProfile(),
    retry: false,
  })

  return (
    <div className="flex flex-col gap-4">
      <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
        Refresh account
      </Button>
      {refresh.error && <ErrorNotice error={refresh.error} />}
    </div>
  )
}

function Enrollment() {
  const user = useSession().user!

  const client = useQueryClient()

  const enroll = useMutation({
    mutationFn: (input: {
      businessName: string
      contactEmail: string
      contactNumber: string
    }) => request<Merchant>('/merchants', { method: 'POST', data: input }),
    retry: false,
    onSuccess: async (merchant) => {
      await auth.revalidateProfile()
      client.setQueryData(merchantQuery(user.userId).queryKey, merchant)
    },
  })

  const form = useForm({
    defaultValues: {
      businessName: '',
      contactEmail: user.email,
      contactNumber: user.phone,
    },
    validators: {
      onSubmit: z.object({
        businessName: z
          .string()
          .trim()
          .min(1, 'Enter your business name.')
          .max(100),
        contactEmail: z.email().max(255),
        contactNumber: z
          .string()
          .regex(/^\+?[0-9]{7,15}$/, 'Use 7 to 15 digits with an optional +.'),
      }),
    },
    onSubmit: async ({ value }) => {
      await enroll.mutateAsync(value).catch(() => undefined)
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create your merchant profile
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Your business</CardTitle>
          <CardDescription>
            Receive simulated NPR in your existing wallet. Creating this profile
            makes your account a merchant. Business contacts are visible to
            signed-in customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (!enroll.isPending) void form.handleSubmit()
            }}
          >
            <FieldGroup>
              {(['businessName', 'contactEmail', 'contactNumber'] as const).map(
                (name) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <Field data-invalid={!field.state.meta.isValid}>
                        <FieldLabel htmlFor={name}>
                          {name === 'businessName'
                            ? 'Business name'
                            : name === 'contactEmail'
                              ? 'Business email'
                              : 'Business phone'}
                        </FieldLabel>
                        <Input
                          id={name}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          aria-invalid={!field.state.meta.isValid}
                          disabled={enroll.isPending}
                          maxLength={
                            name === 'businessName'
                              ? 100
                              : name === 'contactEmail'
                                ? 255
                                : 20
                          }
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                )
              )}
              <Button
                type="submit"
                disabled={enroll.isPending || user.role === 'ADMIN'}
              >
                {enroll.isPending && <Spinner data-icon="inline-start" />}
                Create merchant profile
              </Button>
            </FieldGroup>
          </form>
          {enroll.error && <ErrorNotice error={enroll.error} />}
        </CardContent>
      </Card>
    </div>
  )
}

function Dashboard({ merchant }: { merchant: Merchant }) {
  const user = useSession().user!

  const client = useQueryClient()

  const [page, setPage] = useState(0)

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  const wallet = useQuery({
    ...walletQuery(user.userId),
    refetchInterval: 10000,
  })

  const requests = useQuery({
    queryKey: ['private', user.userId, 'merchant', 'requests', page],
    queryFn: ({ signal }) =>
      request<PaymentRequestPage>('/merchants/payment-requests', {
        signal,
        params: { page, size: 20 },
      }),
    refetchInterval: 10000,
  })

  const payments = useQuery({
    queryKey: ['private', user.userId, 'merchant', 'payments', pagination],
    queryFn: ({ signal }) =>
      request<TransactionPage>('/merchants/payments', {
        signal,
        params: { page: pagination.pageIndex, size: pagination.pageSize },
      }),
    refetchInterval: 10000,
  })

  const cancel = useMutation({
    mutationFn: (id: string) =>
      request<PaymentRequest>(`/merchants/payment-requests/${id}/cancel`, {
        method: 'POST',
      }),
    retry: false,
    onSettled: () =>
      client.invalidateQueries({
        queryKey: ['private', user.userId, 'merchant'],
      }),
  })

  const refresh = () => {
    void client.invalidateQueries({
      queryKey: ['private', user.userId, 'merchant'],
    })
    void wallet.refetch()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {merchant.businessName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Merchant dashboard · {merchant.contactEmail}
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          Refresh dashboard
        </Button>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Merchant wallet</CardTitle>
            <CardDescription>
              Incoming payments settle into your primary wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Badge variant="secondary" className="w-fit">
              {merchant.status}
            </Badge>
            {wallet.error ? (
              <ErrorNotice error={wallet.error} />
            ) : wallet.data ? (
              <p className="text-3xl font-semibold tabular-nums">
                {formatMoney(wallet.data.balance, wallet.data.currency)}
              </p>
            ) : (
              <Spinner />
            )}
            <p className="text-sm text-muted-foreground">
              {merchant.contactNumber}
            </p>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/wallet" />}
            >
              Open wallet
            </Button>
          </CardContent>
        </Card>
        <RequestForm
          onCreated={() => {
            setPage(0)
            refresh()
          }}
          disabled={merchant.status !== 'ACTIVE'}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payment requests</CardTitle>
          <CardDescription>
            Share a payment link with your customer. Each request can be paid
            once. Requests and payments refresh every 10 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {requests.error ? (
            <ErrorNotice
              error={requests.error}
              retry={() => {
                void requests.refetch()
              }}
            />
          ) : requests.isPending ? (
            <PagePending />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data.content.map((p) => (
                  <TableRow key={p.paymentRequestId}>
                    <TableCell className="max-w-56 break-words">
                      <Link
                        to="/payments/$paymentRequestId"
                        params={{ paymentRequestId: p.paymentRequestId }}
                        className="hover:underline"
                      >
                        {p.description || p.paymentRequestId}
                      </Link>
                    </TableCell>
                    <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(p.expiresAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <ShareLink id={p.paymentRequestId} />
                        {p.transactionId && (
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={
                              <Link
                                to="/transactions/$transactionId"
                                params={{ transactionId: p.transactionId }}
                              />
                            }
                          >
                            Receipt
                          </Button>
                        )}
                        {p.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate(p.paymentRequestId)}
                          >
                            Cancel request
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!requests.data.content.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>No payment requests</EmptyTitle>
                          <EmptyDescription>
                            Create a request above to receive a payment.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {cancel.error && <ErrorNotice error={cancel.error} />}
          <div className="flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={!page || requests.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous requests
            </Button>
            <span className="text-sm">Page {page + 1}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!requests.data?.hasNext || requests.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next requests
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Incoming payments</CardTitle>
          <CardDescription>
            Confirmed merchant payments and receipts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.error ? (
            <ErrorNotice
              error={payments.error}
              retry={() => {
                void payments.refetch()
              }}
            />
          ) : (
            <DataTable
              data={payments.data?.content}
              walletId={merchant.walletId}
              loading={payments.isPending}
              fetching={payments.isFetching}
              pagination={pagination}
              onPaginationChange={setPagination}
              rowCount={payments.data?.totalElements ?? 0}
              showPagination
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RequestForm({
  onCreated,
  disabled,
}: {
  onCreated: () => void
  disabled: boolean
}) {
  const create = useMutation({
    mutationFn: (input: { amount: string; description: string }) =>
      request<PaymentRequest>('/merchants/payment-requests', {
        method: 'POST',
        data: input,
      }),
    retry: false,
    onSuccess: onCreated,
  })

  const form = useForm({
    defaultValues: { amount: '', description: '' },
    validators: {
      onSubmit: z.object({
        amount: amountSchema(1000000),
        description: z.string().max(255),
      }),
    },
    onSubmit: async ({ value }) => {
      await create
        .mutateAsync(value)
        .then(() => form.reset())
        .catch(() => undefined)
    },
  })

  const locked = disabled || create.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create payment request</CardTitle>
        <CardDescription>
          Fixed amount in NPR · expires in 24 hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!locked) void form.handleSubmit()
          }}
        >
          <FieldGroup>
            {(['amount', 'description'] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <Field data-invalid={!field.state.meta.isValid}>
                    <FieldLabel htmlFor={`request-${name}`}>
                      {name === 'amount'
                        ? 'Request amount (NPR)'
                        : 'Order description (optional)'}
                    </FieldLabel>
                    <Input
                      id={`request-${name}`}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={locked}
                      aria-invalid={!field.state.meta.isValid}
                      inputMode={name === 'amount' ? 'decimal' : 'text'}
                      maxLength={name === 'description' ? 255 : undefined}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            ))}
            <Button type="submit" disabled={locked}>
              {create.isPending && <Spinner data-icon="inline-start" />}Create
              payment request
            </Button>
          </FieldGroup>
        </form>
        {create.error && <ErrorNotice error={create.error} />}
        {create.data && (
          <div role="status" className="flex flex-wrap items-center gap-3">
            <p>Payment request created.</p>
            <ShareLink id={create.data.paymentRequestId} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ShareLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const [error, setError] = useState<unknown>()

  const url = `${window.location.origin}/payments/${id}`

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
          } catch (copyError) {
            setError(copyError)
          }
        }}
      >
        {copied ? 'Link copied' : 'Copy payment link'}
      </Button>
      {error ? (
        <Input
          aria-label="Payment link"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
        />
      ) : null}
    </div>
  )
}
