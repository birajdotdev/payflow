import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function account(page: Page, name: string, suffix: string) {
  const email = `${name.toLowerCase()}-${suffix}@example.com`
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Phone number').fill(`+977${suffix}`)
  await page.getByLabel('Password', { exact: true }).fill('Demo-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Demo-password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('merchant enrollment, request, customer payment, lost response retry, and shared receipt', async ({
  browser,
}) => {
  const baseURL = process.env.PAYFLOW_BASE_URL ?? 'http://localhost:3000'
  const merchantContext = await browser.newContext({ baseURL })
  const customerContext = await browser.newContext({ baseURL })
  const merchant = await merchantContext.newPage()
  const customer = await customerContext.newPage()
  try {
    const seed = Date.now().toString().slice(-10)
    await account(merchant, 'Merchant', seed)
    await account(customer, 'Customer', (BigInt(seed) + 1n).toString())
    await merchant.goto('/merchant')
    await merchant.getByLabel('Business name').fill('Browser Shop')
    await merchant
      .getByRole('button', { name: 'Create merchant profile' })
      .click()
    await expect(
      merchant.getByRole('heading', { name: 'Browser Shop' })
    ).toBeVisible()
    await merchant.getByLabel('Request amount (NPR)').fill('250.25')
    await merchant
      .getByLabel('Order description (optional)')
      .fill('Order #1028')
    await merchant
      .getByRole('button', { name: 'Create payment request', exact: true })
      .click()
    const link = merchant.getByRole('link', {
      name: 'Order #1028',
      exact: true,
    })
    await expect(link).toBeVisible()
    const path = (await link.getAttribute('href'))!
    await merchant.reload()
    await expect(link).toBeVisible()
    await customer.goto('/wallet')
    await customer.getByLabel('Amount (NPR)').fill('1000.00')
    await customer
      .getByRole('button', { name: 'Add funds', exact: true })
      .click()
    await expect(
      customer.getByText('Operation confirmed.', { exact: true })
    ).toBeVisible()
    await customer.goto(path)
    await expect(
      customer.getByText('Browser Shop', { exact: true })
    ).toBeVisible()
    const attempts: { key: string | undefined; body: string | null }[] = []
    await customer.route('**/api/v1/payments/*/pay', async (route) => {
      attempts.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postData(),
      })
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      if (attempts.length === 1) await route.abort('failed')
      else await route.fulfill({ response })
    })
    await customer
      .getByRole('button', { name: 'Confirm payment', exact: true })
      .click()
    await expect(
      customer.getByText('Outcome unknown', { exact: true })
    ).toBeVisible()
    expect(attempts).toHaveLength(1)
    await customer.reload()
    await expect(
      customer.getByText('Outcome unknown', { exact: true })
    ).toBeVisible()
    expect(attempts).toHaveLength(1)
    await customer
      .getByRole('button', { name: 'Retry original request' })
      .click()
    await expect(
      customer.getByText('Payment confirmed.', { exact: true })
    ).toBeVisible()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(
      await customer.evaluate(() =>
        Object.keys(sessionStorage).filter((k) =>
          k.startsWith('payflow-intent:')
        )
      )
    ).toEqual([])
    await customer.getByRole('button', { name: 'View receipt' }).click()
    const receiptUrl = customer.url()
    await expect(
      customer.getByText('Merchant payment', { exact: true })
    ).toBeVisible()
    await expect(
      customer.getByText('Order #1028', { exact: true })
    ).toBeVisible()
    await customer.reload()
    await expect(
      customer.getByText('Order #1028', { exact: true })
    ).toBeVisible()
    await customer.goto('/wallet')
    await expect(
      customer.getByText('NPR 749.75', { exact: true })
    ).toBeVisible()
    await merchant.getByRole('button', { name: 'Refresh dashboard' }).click()
    await expect(merchant.getByText('PAID', { exact: true })).toBeVisible()
    await expect(
      merchant.getByText('NPR 250.25', { exact: true }).first()
    ).toBeVisible()
    await expect(
      merchant.getByRole('link', {
        name: 'Merchant payment received',
        exact: true,
      })
    ).toHaveCount(1)
    await merchant.getByRole('button', { name: 'Receipt', exact: true }).click()
    await expect(merchant).toHaveURL(receiptUrl)
    await expect(
      merchant.getByText('Order #1028', { exact: true })
    ).toBeVisible()
    await customer.goto(path)
    await expect(
      customer.getByText('Payment confirmed.', { exact: true })
    ).toBeVisible()
    await expect(
      customer.getByRole('button', { name: 'Confirm payment', exact: true })
    ).toHaveCount(0)
    expect(attempts).toHaveLength(2)
  } finally {
    await merchantContext.close()
    await customerContext.close()
  }
})
