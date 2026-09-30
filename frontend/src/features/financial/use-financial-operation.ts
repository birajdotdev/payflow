import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'

import { useSession } from '@/features/auth/session'

import {
  amountSchema,
  ambiguous,
  financialSchema,
  lookupIntent,
  submitIntent,
  savedIntentSchema,
} from './operation'
import type { Intent } from './operation'

export function useFinancialOperation(
  transfer: boolean,
  payment?: { paymentRequestId: string; amount: string }
) {
  const user = useSession().user!

  const client = useQueryClient()

  const operation = payment
    ? 'MERCHANT_PAYMENT'
    : transfer
      ? 'TRANSFER'
      : 'DEPOSIT'

  const scope = payment ? `${operation}:${payment.paymentRequestId}` : operation

  const intentKey = ['private', user.userId, 'intent', scope]

  const storageKey = `payflow-intent:${user.userId}:${scope}`

  const stored = useQuery<Intent | null>({
    queryKey: intentKey,
    queryFn: () => null,
    initialData: () => {
      try {
        const saved = savedIntentSchema.parse(
          JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
        )
        return saved.operation === operation &&
          (!payment ||
            saved.payload.paymentRequestId === payment.paymentRequestId)
          ? saved
          : null
      } catch {
        return null
      }
    },
    enabled: false,
    gcTime: Infinity,
  })

  const intent = stored.data ?? null

  const setIntent = (value: Intent | null) => {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value))
    else sessionStorage.removeItem(storageKey)
    client.setQueryData(intentKey, value)
  }

  const [review, setReview] = useState<Intent['payload'] | null>(null)

  const [uncertain, setUnknown] = useState(false)

  const [receipt, setReceipt] = useState<string | null>(null)

  const complete = (id: string) => {
    setReceipt(id)
    setUnknown(false)
    setIntent(null)
    void client.invalidateQueries({
      queryKey: ['private', user.userId, 'wallet'],
    })
    void client.invalidateQueries({
      queryKey: ['private', user.userId, 'transactions'],
    })
    void client.invalidateQueries({
      queryKey: ['private', user.userId, 'merchant'],
    })
    void client.invalidateQueries({
      queryKey: ['private', user.userId, 'payments'],
    })
  }

  const mutation = useMutation({
    mutationFn: submitIntent,
    retry: false,
    onSuccess: (result) => complete(result.transactionId),
    onError: (error) => {
      if (ambiguous(error) || uncertain) setUnknown(true)
      else setIntent(null)
    },
  })

  const lookup = useMutation({
    mutationFn: lookupIntent,
    retry: false,
    onSuccess: (result) => {
      if (result.state === 'FOUND' && result.transaction)
        complete(result.transaction.transactionId)
    },
  })

  const schema = financialSchema.extend({
    amount: amountSchema(transfer ? 1000000 : 100000),
    receiverWalletId: transfer
      ? z.uuid('Enter a valid wallet UUID.')
      : z.string(),
  })

  const form = useForm({
    defaultValues: {
      amount: intent?.payload.amount ?? '',
      receiverWalletId: intent?.payload.receiverWalletId ?? '',
      description: intent?.payload.description ?? '',
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (transfer) {
        mutation.reset()
        setReview({ ...value })
        return
      }
      const saved: Intent = {
        operation: 'DEPOSIT',
        key: crypto.randomUUID(),
        payload: { amount: value.amount },
      }
      setIntent(saved)
      await mutation.mutateAsync(saved).catch(() => undefined)
    },
  })

  const unknown =
    uncertain || (intent !== null && !mutation.isPending && receipt === null)

  const locked =
    mutation.isPending || lookup.isPending || unknown || receipt !== null

  return {
    confirmPayment: () => {
      if (!payment || locked) return
      const saved: Intent = {
        operation: 'MERCHANT_PAYMENT',
        key: crypto.randomUUID(),
        payload: { ...payment },
      }
      setIntent(saved)
      mutation.mutate(saved)
    },
    form,
    review,
    editReview: () => setReview(null),
    confirmTransfer: () => {
      if (!review || locked) return
      const saved: Intent = {
        operation: 'TRANSFER',
        key: crypto.randomUUID(),
        payload: { ...review },
      }
      setReview(null)
      setIntent(saved)
      mutation.mutate(saved)
    },
    intent,
    unknown,
    receipt,
    mutation,
    lookup,
    locked,
    startAnother: () => {
      setReceipt(null)
      setIntent(null)
      mutation.reset()
      lookup.reset()
      form.reset()
    },
    retryOriginal: () => {
      if (intent) {
        setUnknown(true)
        mutation.mutate(intent)
      }
    },
  }
}
