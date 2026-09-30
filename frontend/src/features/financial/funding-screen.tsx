import {
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useEffect } from 'react'

import { ErrorNotice } from '@/components/feedback'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { WalletId } from '@/components/wallet-id'

import { ReceiptDialog } from './receipt-dialog'
import { useFinancialOperation } from './use-financial-operation'
export function FundingScreen({
  transfer = false,
  compact = false,
  onStateChange,
}: {
  transfer?: boolean
  compact?: boolean
  onStateChange?: (state: { pending: boolean; unknown: boolean }) => void
}) {
  const {
    form,
    review,
    editReview,
    confirmTransfer,
    intent,
    unknown,
    receipt,
    mutation,
    lookup,
    locked,
    startAnother,
    retryOriginal,
  } = useFinancialOperation(transfer)
  const pending = mutation.isPending || lookup.isPending
  useEffect(() => {
    onStateChange?.({ pending, unknown })
  }, [onStateChange, pending, unknown])

  const formContent = (
    <>
      {!compact && (
        <CardHeader>
          <CardTitle>
            {transfer ? 'Transfer details' : 'Add demo funds'}
          </CardTitle>
          <CardDescription>
            {transfer
              ? 'Send NPR directly to another PayFlow wallet.'
              : 'Top up your wallet with simulated NPR funds.'}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-6">
        {review ? (
          <section aria-label="Transfer review" className="flex flex-col gap-6">
            <h2
              className="text-lg font-semibold"
              tabIndex={-1}
              ref={(node) => node?.focus()}
            >
              Review transfer
            </h2>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 text-sm">
              <dt>Recipient</dt>
              <dd className="break-all">{review.receiverWalletId}</dd>
              <dt>Amount</dt>
              <dd>NPR {review.amount}</dd>
              <dt>Fee</dt>
              <dd>NPR 0.00</dd>
              <dt>Total</dt>
              <dd>NPR {review.amount}</dd>
              {review.description ? (
                <>
                  <dt>Description</dt>
                  <dd className="break-words">{review.description}</dd>
                </>
              ) : null}
            </dl>
            <p className="text-sm text-muted-foreground">
              PayFlow demo transfers have no fee. Confirm to send this amount.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={editReview}>
                Edit transfer
              </Button>
              <Button disabled={locked} onClick={confirmTransfer}>
                Confirm transfer
              </Button>
            </div>
          </section>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              if (!locked) void form.handleSubmit()
            }}
          >
            <FieldGroup>
              {(
                [
                  'amount',
                  ...(transfer
                    ? (['receiverWalletId', 'description'] as const)
                    : []),
                ] as const
              ).map((name) => (
                <form.Field key={name} name={name}>
                  {(field) => {
                    const invalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    const inputProps = {
                      id: name,
                      name,
                      value: field.state.value,
                      disabled: locked,
                      onBlur: field.handleBlur,
                      onChange: (
                        event: React.ChangeEvent<
                          HTMLInputElement | HTMLTextAreaElement
                        >
                      ) => field.handleChange(event.target.value),
                      'aria-invalid': invalid,
                      'aria-describedby': `${name}-hint${invalid ? ` ${name}-error` : ''}`,
                    }
                    return (
                      <Field data-invalid={invalid} data-disabled={locked}>
                        <FieldLabel htmlFor={name}>
                          {name === 'amount'
                            ? 'Amount (NPR)'
                            : name === 'description'
                              ? 'Description (optional)'
                              : 'Recipient wallet number'}
                        </FieldLabel>
                        {name === 'amount' ? (
                          <InputGroup>
                            <InputGroupAddon>
                              <InputGroupText>NPR</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                              {...inputProps}
                              inputMode="decimal"
                              placeholder="0.00"
                            />
                          </InputGroup>
                        ) : name === 'description' ? (
                          <Textarea
                            {...inputProps}
                            placeholder="What is this transfer for?"
                            maxLength={255}
                          />
                        ) : (
                          <Input
                            {...inputProps}
                            placeholder="Paste the recipient’s wallet UUID"
                            autoComplete="off"
                          />
                        )}
                        <FieldDescription id={`${name}-hint`}>
                          {name === 'amount'
                            ? transfer
                              ? 'NPR 0.01 to 1,000,000.00. Up to two decimal places.'
                              : 'NPR 0.01 to 100,000.00 per deposit.'
                            : name === 'description'
                              ? 'A short note to identify your transfer. Up to 255 characters.'
                              : 'Ask the recipient to share their wallet number from My wallet.'}
                        </FieldDescription>
                        {invalid && (
                          <FieldError
                            id={`${name}-error`}
                            errors={field.state.meta.errors}
                          />
                        )}
                      </Field>
                    )
                  }}
                </form.Field>
              ))}
              <Button type="submit" size="lg" disabled={locked}>
                {mutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : transfer ? (
                  <ArrowUpRight data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                {mutation.isPending
                  ? 'Submitting…'
                  : transfer
                    ? 'Review transfer'
                    : 'Add funds'}
              </Button>
            </FieldGroup>
          </form>
        )}
        {mutation.error && !unknown && (
          <ErrorNotice inline error={mutation.error} />
        )}
        {unknown && intent && (
          <Alert variant="warning" role="status">
            <CircleHelp />
            <AlertTitle>Outcome unknown</AlertTitle>
            <AlertDescription className="flex flex-col gap-4">
              <p>
                Your request may still be running. Check its status before
                starting another operation.
              </p>
              <p>Original amount: NPR {intent.payload.amount}</p>
              {intent.payload.receiverWalletId && (
                <WalletId
                  value={intent.payload.receiverWalletId}
                  label="Recipient wallet ID"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={lookup.isPending || mutation.isPending}
                  onClick={() => lookup.mutate(intent)}
                >
                  {lookup.isPending && <Spinner data-icon="inline-start" />}
                  Check outcome
                </Button>
                <Button
                  variant="outline"
                  disabled={lookup.isPending || mutation.isPending}
                  onClick={retryOriginal}
                >
                  Retry original request
                </Button>
              </div>
              {lookup.isSuccess && lookup.data.state === 'UNKNOWN' && (
                <p>
                  No committed result found yet. This does not mean the request
                  failed.
                </p>
              )}
              {lookup.error && <ErrorNotice inline error={lookup.error} />}
              <details className="text-xs">
                <summary>Request details</summary>
                <p className="mt-2 break-all">Operation key: {intent.key}</p>
              </details>
            </AlertDescription>
          </Alert>
        )}
        {receipt && (
          <Alert variant="success" role="status">
            <CheckCircle2 />
            <AlertTitle>Operation confirmed.</AlertTitle>
            <AlertDescription>
              <p>Your transaction is recorded and your wallet is updating.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ReceiptDialog transactionId={receipt} />
                <Button size="sm" variant="outline" onClick={startAnother}>
                  Start another operation
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" />
        Simulated funds · No real money is moved
      </CardFooter>
    </>
  )
  const formCard = compact ? formContent : <Card>{formContent}</Card>
  if (!transfer) return formCard
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Send money</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A simple transfer from your wallet to theirs.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {formCard}
        <Card>
          <CardHeader>
            <CardTitle>Before you send</CardTitle>
            <CardDescription>A few details to double-check.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-4 pl-4 text-sm text-muted-foreground">
              <li>Copy the recipient’s wallet number exactly.</li>
              <li>Check the amount and add a note if helpful.</li>
              <li>Keep your receipt to review the confirmed result.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
