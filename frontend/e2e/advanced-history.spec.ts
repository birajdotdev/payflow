import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

test('real history combines amount and counterparty filters with payment/refund types', async ({
  browser,
}) => {
  const baseURL = process.env.PAYFLOW_BASE_URL ?? 'http://localhost:3000'
  const customer = await browser.newContext({ baseURL })
  const merchant = await browser.newContext({ baseURL })
  const seed = Date.now().toString().slice(-10)
  async function account(request: APIRequestContext, suffix: string) {
    const data = {
      fullName: 'History Tester',
      email: `history-${suffix}@example.com`,
      phone: `+977${suffix}`,
      password: 'Demo-password-123',
    }
    const headers = { Origin: baseURL, 'X-PayFlow-CSRF': '1' }
    expect(
      (await request.post('/api/v1/auth/register', { data, headers })).status()
    ).toBe(201)
    const login = await request.post('/api/v1/auth/login', {
      data: { email: data.email, password: data.password },
      headers,
    })
    expect(login.status()).toBe(200)
    return { Authorization: `Bearer ${(await login.json()).data.accessToken}` }
  }
  async function post(
    request: APIRequestContext,
    path: string,
    headers: Record<string, string>,
    data?: unknown
  ) {
    const response = await request.post(`/api/v1${path}`, {
      headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      ...(data === undefined ? {} : { data }),
    })
    expect(
      response.ok(),
      `${path}: ${response.status()} ${await response.text()}`
    ).toBe(true)
    return (await response.json()).data
  }
  try {
    const customerHeaders = await account(customer.request, seed)
    const merchantHeaders = await account(
      merchant.request,
      (BigInt(seed) + 1n).toString()
    )
    const merchantWallet = (
      await (
        await merchant.request.get('/api/v1/wallet', {
          headers: merchantHeaders,
        })
      ).json()
    ).data.walletId
    await post(customer.request, '/wallet/deposit', customerHeaders, {
      amount: '1000.00',
    })
    const lower = await post(customer.request, '/transfers', customerHeaders, {
      receiverWalletId: merchantWallet,
      amount: '25.25',
      description: 'Lower boundary',
    })
    const upper = await post(customer.request, '/transfers', customerHeaders, {
      receiverWalletId: merchantWallet,
      amount: '50.00',
      description: 'Upper boundary',
    })
    await post(merchant.request, '/merchants', merchantHeaders, {
      businessName: 'History Shop',
      contactEmail: 'history-shop@example.com',
      contactNumber: '+9779812345678',
    })
    const paymentRequest = await post(
      merchant.request,
      '/merchants/payment-requests',
      merchantHeaders,
      { amount: '25.25', description: 'Filter order' }
    )
    const payment = await post(
      customer.request,
      `/payments/${paymentRequest.paymentRequestId}/pay`,
      customerHeaders
    )
    const refund = await post(
      merchant.request,
      `/merchants/payments/${payment.transactionId}/refund`,
      merchantHeaders
    )
    const page = await customer.newPage()
    await page.goto(
      `/transactions?size=1&type=TRANSFER&minAmount=25.25&maxAmount=50&counterpartyWalletId=${merchantWallet}`
    )
    await expect(page.getByText(upper.reference, { exact: true })).toBeVisible()
    await expect(page.getByText('2 transactions · Page 1 of 2')).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText(lower.reference, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Minimum amount')).toHaveValue('25.25')
    await expect(page.getByText(lower.reference, { exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Type', exact: true }).click()
    await page
      .getByRole('option', { name: 'Merchant payment', exact: true })
      .click()
    await expect(
      page.getByText(payment.reference, { exact: true })
    ).toBeVisible()
    await page.getByRole('combobox', { name: 'Type', exact: true }).click()
    await page.getByRole('option', { name: 'Refund', exact: true }).click()
    await expect(
      page.getByText(refund.reference, { exact: true })
    ).toBeVisible()
    await page
      .getByLabel('Counterparty wallet ID')
      .fill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    await page.getByRole('button', { name: 'Apply advanced filters' }).click()
    await expect(page.getByText('No matching transactions')).toBeVisible()
    await expect(page.getByText('0 transactions · Page 1 of 1')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('5 transactions · Page 1 of 5')).toBeVisible()
  } finally {
    await customer.close()
    await merchant.close()
  }
})
