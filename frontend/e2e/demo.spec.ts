import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function register(page: Page, name: string, suffix: string) {
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Phone number').fill(`+977${suffix}`)
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.com`
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Demo-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Demo-password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.goto('/wallet')
  return page
    .getByRole('textbox', { name: 'Wallet ID', exact: true })
    .inputValue()
}

test('static deep links, API forwarding and missing assets', async ({
  request,
}) => {
  const nested = await request.get(
    '/transactions/00000000-0000-0000-0000-000000000000'
  )
  expect(nested.status()).toBe(200)
  expect(nested.headers()['content-type']).toContain('text/html')
  const api = await request.get('/api/v1/wallet')
  expect(api.status()).toBe(401)
  expect(api.headers()['content-type']).toContain('application/json')
  const unknownApi = await request.get('/api/missing.json')
  expect(unknownApi.headers()['content-type']).toContain('application/json')
  expect(unknownApi.status()).toBeGreaterThanOrEqual(400)
  expect((await request.get('/assets/does-not-exist.js')).status()).toBe(404)
})

test('two users fund, transfer, restore, safely retry and revoke logout', async ({
  browser,
}) => {
  const baseURL = process.env.PAYFLOW_BASE_URL ?? 'http://localhost:3000'
  const aliceContext = await browser.newContext({ baseURL })
  const bobContext = await browser.newContext({ baseURL })
  const alice = await aliceContext.newPage()
  const bob = await bobContext.newPage()
  try {
    const seed = Date.now().toString().slice(-10)
    await register(alice, 'Alice Demo', seed)
    const bobWallet = await register(
      bob,
      'Bob Demo',
      (BigInt(seed) + 1n).toString()
    )
    await alice.getByLabel('Amount (NPR)').fill('1000.00')
    await alice.getByRole('button', { name: 'Add funds', exact: true }).click()
    await expect(
      alice.getByText('Operation confirmed.', { exact: true })
    ).toBeVisible()
    await expect(alice.getByText('NPR 1,000.00', { exact: true })).toBeVisible()
    await alice.goto('/send')
    await alice.getByLabel('Amount (NPR)').fill('250.25')
    await alice.getByLabel('Recipient wallet number').fill(bobWallet)
    await alice.getByLabel('Description (optional)').fill('Browser demo')
    const attempts: { key: string | undefined; body: string | null }[] = []
    let oldAccess = ''
    // Commit at the backend, then lose the response at the browser boundary.
    await alice.route('**/api/v1/transfers', async (route) => {
      attempts.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postData(),
      })
      oldAccess = route.request().headers()['authorization']
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      if (attempts.length === 1) await route.abort('failed')
      else await route.fulfill({ response })
    })
    await alice.getByRole('button', { name: 'Send money', exact: true }).click()
    await expect(
      alice.getByText('Outcome unknown', { exact: true })
    ).toBeVisible()
    expect(attempts).toHaveLength(1)
    await alice.reload()
    await expect(
      alice.getByText('Outcome unknown', { exact: true })
    ).toBeVisible()
    expect(attempts).toHaveLength(1)
    await expect(alice.getByLabel('Amount (NPR)')).toHaveValue('250.25')
    await alice.getByRole('button', { name: 'Retry original request' }).click()
    await expect(
      alice.getByText('Operation confirmed.', { exact: true })
    ).toBeVisible()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    await alice.getByRole('button', { name: 'View receipt' }).click()
    await expect(alice).toHaveURL(/\/transactions\/[a-f0-9-]+/)
    await alice.reload()
    await expect(alice.getByText('Browser demo', { exact: true })).toBeVisible()
    await alice.goto('/wallet')
    await expect(alice.getByText('NPR 749.75', { exact: true })).toBeVisible()
    await bob.reload()
    await expect(bob.getByText('NPR 250.25', { exact: true })).toBeVisible()
    await alice.goto('/transactions')
    await expect(alice.getByRole('row')).toHaveCount(3)
    await alice.unroute('**/api/v1/transfers')
    await alice.goto('/send')
    await alice.getByLabel('Amount (NPR)').fill('1000')
    await alice.getByLabel('Recipient wallet number').fill(bobWallet)
    await alice.getByRole('button', { name: 'Send money', exact: true }).click()
    await expect(alice.getByText(/Insufficient wallet balance/)).toBeVisible()
    await alice.goto('/wallet')
    await expect(alice.getByText('NPR 749.75', { exact: true })).toBeVisible()
    await alice
      .getByRole('button', { name: /Alice Demo.*alice-demo-/i })
      .click()
    const refreshCookie = (await aliceContext.cookies()).find(
      (cookie) => cookie.name === 'payflow_refresh'
    )!
    await alice.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(alice).toHaveURL(/\/login/)
    expect(
      await alice.evaluate(() =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith('payflow-intent:')
        )
      )
    ).toEqual([])
    expect(
      (
        await aliceContext.request.get('/api/v1/wallet', {
          headers: { Authorization: oldAccess },
        })
      ).status()
    ).toBe(401)
    expect(
      (
        await aliceContext.request.post('/api/v1/auth/refresh', {
          headers: {
            Origin: new URL(baseURL).origin,
            Cookie: `payflow_refresh=${refreshCookie.value}`,
            'X-PayFlow-CSRF': '1',
          },
        })
      ).status()
    ).toBe(401)
    await alice.goto('/wallet')
    await expect(alice).toHaveURL(/\/login/)
    await expect(alice.getByText('NPR 749.75', { exact: true })).toHaveCount(0)
    await expect(bob.getByText('NPR 250.25', { exact: true })).toBeVisible()
  } finally {
    await aliceContext.close()
    await bobContext.close()
  }
})
