import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, Store, RefreshCw, Link2, ArrowDownLeft } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyMedia,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { auth, useSession } from '@/features/auth/session'
import { amountSchema } from '@/features/financial/operation'
import { formatMoney, walletQuery } from '@/features/wallet/queries'
import type { TransactionPage } from '@/features/wallet/queries'
import { request } from '@/lib/api'

import { PaymentRequestsTable } from './payment-requests-table'
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
      {refresh.error && <ErrorNotice inline error={refresh.error} />}
    </div>
  )
}

function Enrollment() {
  const [open, setOpen] = useState(false)
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
      toast.add({
        title: 'Your merchant profile is ready',
        description: 'Create a payment link to receive your first payment.',
        type: 'success',
      })
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Merchant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A home for your business payments.
        </p>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!enroll.isPending) setOpen(next)
        }}
      >
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store />
            </EmptyMedia>
            <EmptyTitle>Start accepting payments</EmptyTitle>
            <EmptyDescription>
              Create a business profile, share a payment link, and receive
              simulated NPR into your existing wallet.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <DialogTrigger render={<Button />} disabled={user.role === 'ADMIN'}>
              <Plus data-icon="inline-start" />
              Set up merchant profile
            </DialogTrigger>
            <p className="text-xs text-muted-foreground">
              Your business contacts will be visible to signed-in customers.
            </p>
          </EmptyContent>
        </Empty>
        <DialogContent
          className="sm:max-w-lg"
          showCloseButton={!enroll.isPending}
        >
          <DialogHeader>
            <DialogTitle>Create your merchant profile</DialogTitle>
            <DialogDescription>
              Your account will become a merchant. Payments settle into your
              existing wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                if (!enroll.isPending) void form.handleSubmit()
              }}
            >
              <FieldGroup>
                {(
                  ['businessName', 'contactEmail', 'contactNumber'] as const
                ).map((name) => (
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
                ))}
                <Button
                  type="submit"
                  disabled={enroll.isPending || user.role === 'ADMIN'}
                >
                  {enroll.isPending && <Spinner data-icon="inline-start" />}
                  Create merchant profile
                </Button>
              </FieldGroup>
            </form>
            {enroll.error && <ErrorNotice inline error={enroll.error} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Dashboard({ merchant }: { merchant: Merchant }) {
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestPending, setRequestPending] = useState(false)
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
    onSuccess: () =>
      toast.add({ title: 'Payment request cancelled', type: 'success' }),
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw data-icon="inline-start" />
            Refresh dashboard
          </Button>
          <Dialog
            open={requestOpen}
            onOpenChange={(next) => {
              if (!requestPending) setRequestOpen(next)
            }}
          >
            <DialogTrigger
              render={<Button />}
              disabled={merchant.status !== 'ACTIVE'}
            >
              <Plus data-icon="inline-start" />
              New payment request
            </DialogTrigger>
            <DialogContent
              className="sm:max-w-lg"
              showCloseButton={!requestPending}
            >
              <DialogHeader>
                <DialogTitle>Create payment request</DialogTitle>
                <DialogDescription>
                  A fixed amount in NPR. Your link expires in 24 hours and can
                  be paid once.
                </DialogDescription>
              </DialogHeader>
              <RequestForm
                disabled={merchant.status !== 'ACTIVE'}
                onPendingChange={setRequestPending}
                onCreated={() => {
                  setRequestOpen(false)
                  setPage(0)
                  refresh()
                  toast.add({
                    title: 'Payment request created',
                    description:
                      'Copy the link from your requests to share it with your customer.',
                    type: 'success',
                  })
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2">
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
        <Card>
          <CardHeader>
            <CardDescription>Business profile</CardDescription>
            <CardTitle>{merchant.businessName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Badge variant="outline" className="w-fit">
              <Store />
              {merchant.status}
            </Badge>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Business email</dt>
                <dd className="break-all">{merchant.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Business phone</dt>
                <dd>{merchant.contactNumber}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
      <Tabs defaultValue="requests" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="requests">
            <Link2 />
            Payment requests
          </TabsTrigger>
          <TabsTrigger value="payments">
            <ArrowDownLeft />
            Incoming payments
          </TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Payment requests</CardTitle>
              <CardDescription>
                Share a payment link with your customer. Each request can be
                paid once. Requests and payments refresh every 10 seconds.
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
              ) : (
                <PaymentRequestsTable
                  data={requests.data?.content}
                  loading={requests.isPending}
                  fetching={requests.isFetching}
                  rowCount={requests.data?.totalElements ?? 0}
                  pagination={{ pageIndex: page, pageSize: 20 }}
                  onPaginationChange={(update) => {
                    const current = { pageIndex: page, pageSize: 20 }
                    setPage(
                      (typeof update === 'function' ? update(current) : update)
                        .pageIndex
                    )
                  }}
                  cancelling={cancel.isPending}
                  onCancel={cancel.mutate}
                  onCreate={() => setRequestOpen(true)}
                  canCreate={merchant.status === 'ACTIVE'}
                />
              )}
              {cancel.error && <ErrorNotice inline error={cancel.error} />}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RequestForm({
  onCreated,
  disabled,
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void
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
    onMutate: () => onPendingChange(true),
    onSettled: () => onPendingChange(false),
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
    <div className="flex flex-col gap-4">
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
      {create.error && <ErrorNotice inline error={create.error} />}
    </div>
  )
}
