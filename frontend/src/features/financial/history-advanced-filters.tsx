import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

function amountInCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

const amount = z
  .string()
  .refine(
    (value) =>
      value === '' ||
      (/^\d+(\.\d{1,2})?$/.test(value) && amountInCents(value) <= 100000000n),
    'Enter an amount from 0 to 1,000,000 with at most two decimal places.'
  )
export const advancedFiltersSchema = z
  .object({
    minAmount: amount,
    maxAmount: amount,
    counterpartyWalletId: z.union([
      z.literal(''),
      z.uuid('Enter a complete wallet UUID.'),
    ]),
  })
  .refine(
    (value) =>
      !value.minAmount ||
      !value.maxAmount ||
      !/^\d+(\.\d{1,2})?$/.test(value.minAmount) ||
      !/^\d+(\.\d{1,2})?$/.test(value.maxAmount) ||
      amountInCents(value.minAmount) <= amountInCents(value.maxAmount),
    {
      message: 'Minimum amount must not exceed maximum amount.',
      path: ['maxAmount'],
    }
  )
export type AdvancedFilters = z.infer<typeof advancedFiltersSchema>

export function HistoryAdvancedFilters({
  initial,
  apply,
}: {
  initial: AdvancedFilters
  apply: (values: AdvancedFilters) => void
}) {
  const form = useForm({
    defaultValues: initial,
    validators: {
      onChange: advancedFiltersSchema,
      onSubmit: advancedFiltersSchema,
    },
    onSubmit: ({ value }) => apply(value),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="mt-4 flex flex-col gap-4"
    >
      <FieldGroup className="grid gap-4 sm:grid-cols-3">
        {(['minAmount', 'maxAmount', 'counterpartyWalletId'] as const).map(
          (name) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor={name}>
                    {name === 'minAmount'
                      ? 'Minimum amount'
                      : name === 'maxAmount'
                        ? 'Maximum amount'
                        : 'Counterparty wallet ID'}
                  </FieldLabel>
                  <Input
                    id={name}
                    value={field.state.value}
                    inputMode={
                      name === 'counterpartyWalletId' ? 'text' : 'decimal'
                    }
                    aria-invalid={!field.state.meta.isValid}
                    aria-describedby={`${name}-help${!field.state.meta.isValid ? ` ${name}-error` : ''}`}
                    onChange={(event) =>
                      field.handleChange(event.target.value.trim())
                    }
                    onBlur={field.handleBlur}
                    maxLength={name === 'counterpartyWalletId' ? 36 : 32}
                  />
                  <FieldDescription id={`${name}-help`}>
                    {name === 'counterpartyWalletId'
                      ? 'Exact wallet UUID, sent or received. Deposits have no counterparty.'
                      : 'Inclusive · NPR'}
                  </FieldDescription>
                  <FieldError
                    id={`${name}-error`}
                    errors={field.state.meta.errors}
                  />
                </Field>
              )}
            </form.Field>
          )
        )}
      </FieldGroup>
      <div className="flex justify-end">
        <Button type="submit" variant="outline">
          Apply advanced filters
        </Button>
      </div>
    </form>
  )
}
