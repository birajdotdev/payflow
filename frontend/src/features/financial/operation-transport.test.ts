import { AxiosHeaders } from 'axios'
import { afterEach, expect, it } from 'vite-plus/test'

import { api } from '@/lib/api'

import { lookupIntent, submitIntent } from './operation'
import type { Intent } from './operation'

const adapter = api.defaults.adapter

const intent: Intent = {
  operation: 'MERCHANT_PAYMENT',
  key: 'checkout',
  payload: {
    amount: '250.25',
    paymentRequestId: '11111111-1111-4111-8111-111111111111',
  },
}

afterEach(() => {
  api.defaults.adapter = adapter
})

it('submits only the request identity and original key, with the backend supplying the price', async () => {
  const transactionId = '22222222-2222-4222-8222-222222222222'
  api.defaults.adapter = async (config) => {
    expect(config.url).toBe(`/payments/${intent.payload.paymentRequestId}/pay`)
    expect(config.headers.get('Idempotency-Key')).toBe('checkout')
    expect(config.data).toBeUndefined()
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: { success: true, data: { transactionId } },
    }
  }
  expect(await submitIntent(intent)).toEqual({ transactionId })
})

it('keeps malformed receipts and reconciliation responses ambiguous', async () => {
  for (const data of [null, {}, { transactionId: 'bad' }]) {
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: { success: true, data },
    })
    await expect(submitIntent(intent)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  }
  for (const data of [
    null,
    {},
    { state: 'FOUND', transaction: null },
    {
      state: 'UNKNOWN',
      transaction: { transactionId: '22222222-2222-4222-8222-222222222222' },
    },
    { state: 'FOUND', transaction: { transactionId: 'bad' } },
  ]) {
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: { success: true, data },
    })
    await expect(lookupIntent(intent)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  }
})
