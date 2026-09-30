import { expect, it } from 'vite-plus/test'

import { ApiError } from '@/lib/api'

import { ambiguous, amountSchema, savedIntentSchema } from './operation'

it('accepts exact decimal input and rejects rounding, exponents and limits', () => {
  const schema = amountSchema(100000)
  for (const value of ['0.01', '100000.00', '250.25'])
    expect(schema.parse(value)).toBe(value)
  for (const value of ['0', '-1', '1.001', '1e3', '100000.01', 'Infinity'])
    expect(schema.safeParse(value).success).toBe(false)
})

it('retains unknown outcomes for transport, server and malformed response errors', () => {
  for (const error of [
    new Error('offline'),
    new ApiError('timeout'),
    new ApiError('server', 503),
    new ApiError('invalid', 200, 'INVALID_RESPONSE'),
  ])
    expect(ambiguous(error)).toBe(true)
  for (const status of [400, 401, 403, 409, 422])
    expect(ambiguous(new ApiError('rejected', status))).toBe(false)
})

it('validates persisted intents before offering a same-key retry', () => {
  const intent = {
    operation: 'TRANSFER',
    key: 'original-key',
    payload: {
      amount: '250.25',
      receiverWalletId: 'a596cb03-3784-4f42-9ac6-d25962d6807a',
      description: 'Dinner',
    },
  }
  expect(savedIntentSchema.parse(intent)).toEqual(intent)
  expect(
    savedIntentSchema.safeParse({ ...intent, key: 'invalid key' }).success
  ).toBe(false)
  expect(
    savedIntentSchema.safeParse({ ...intent, payload: { amount: '1.001' } })
      .success
  ).toBe(false)
})
