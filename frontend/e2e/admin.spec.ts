import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const password = 'Demo-password-123'
async function signIn(page: Page, email: string) {
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}
async function register(page: Page, name: string, suffix: string) {
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.com`
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Phone number').fill(`+977${suffix}`)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/login/)
  await signIn(page, email)
  return email
}

test('complete admin workflow, pagination, audit, frozen recovery, suspension and fresh login', async ({
  browser,
}) => {
  test.setTimeout(180_000)
  const baseURL = process.env.PAYFLOW_BASE_URL ?? 'http://localhost:3000'
  const adminContext = await browser.newContext({ baseURL })
  const customerContext = await browser.newContext({ baseURL })
  const admin = await adminContext.newPage()
  const customer = await customerContext.newPage()
  const seed = Date.now().toString().slice(-10)
  try {
    // Ensure pagination is exercised even on an otherwise empty demo database.
    for (let i = 0; i < 21; i++) {
      const response = await admin.request.post('/api/v1/auth/register', {
        headers: { Origin: baseURL, 'X-PayFlow-CSRF': '1' },
        data: {
          fullName: `Pagination ${i}`,
          email: `admin-page-${seed}-${i}@example.com`,
          phone: `+977${seed}${String(i).padStart(2, '0')}`,
          password,
        },
      })
      expect(response.status()).toBe(201)
    }
    const customerEmail = await register(
      customer,
      'Admin Customer',
      (BigInt(seed) + 40n).toString()
    )
    const adminEmail = await register(
      admin,
      'Demo Administrator',
      (BigInt(seed) + 41n).toString()
    )
    execFileSync('bash', ['../scripts/provision-demo-admin.sh', adminEmail], {
      stdio: 'pipe',
    })
    const noOp = execFileSync(
      'bash',
      ['../scripts/provision-demo-admin.sh', adminEmail],
      { encoding: 'utf8' }
    )
    expect(noOp).toContain('Already ADMIN; no change')
    await admin.reload()
    await expect(admin).toHaveURL(/\/login/)
    await signIn(admin, adminEmail)
    await admin
      .getByRole('link', { name: 'Administration', exact: true })
      .click()
    await expect(
      admin.getByRole('heading', { name: 'Administration', exact: true })
    ).toBeVisible()
    await admin.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(admin.getByText(/Page 2 of/)).toBeVisible()
    await admin.getByRole('button', { name: 'Previous', exact: true }).click()
    await admin
      .getByRole('button', {
        name: `View account ${customerEmail}`,
        exact: true,
      })
      .click()
    const details = admin.getByRole('dialog', {
      name: 'Account details',
      exact: true,
    })
    await expect(
      details.getByText(customerEmail, { exact: false }).first()
    ).toBeVisible()
    await details
      .getByRole('button', { name: 'Suspend account', exact: true })
      .click()
    const suspend = admin.getByRole('dialog', {
      name: 'Confirm suspend account',
      exact: true,
    })
    await expect(
      suspend.getByText(/All login sessions will be revoked/)
    ).toBeVisible()
    await expect(
      suspend.getByText(customerEmail, { exact: false })
    ).toBeVisible()
    await suspend.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(
      details.getByRole('button', { name: 'Suspend account', exact: true })
    ).toBeVisible()
    await details.getByRole('button', { name: 'Close', exact: true }).click()

    // Commit funding, lose its response, then freeze before explicit recovery.
    await customer.goto('/wallet')
    let attempts = 0
    const keys: (string | undefined)[] = []
    await customer.route('**/api/v1/wallet/deposit', async (route) => {
      attempts++
      keys.push(route.request().headers()['idempotency-key'])
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      if (attempts === 1) await route.abort('failed')
      else await route.fulfill({ response })
    })
    await customer.getByRole('button', { name: 'Add demo funds' }).click()
    await customer.getByLabel('Amount (NPR)').fill('100.00')
    await customer
      .getByRole('button', { name: 'Add funds', exact: true })
      .click()
    await expect(
      customer.getByText('Outcome unknown', { exact: true })
    ).toBeVisible()
    await admin.getByRole('tab', { name: 'Wallets', exact: true }).click()
    await admin
      .getByRole('button', {
        name: `View wallet ${customerEmail}`,
        exact: true,
      })
      .click()
    const walletDetails = admin.getByRole('dialog', {
      name: 'Wallet details',
      exact: true,
    })
    await walletDetails
      .getByRole('button', { name: 'Freeze wallet', exact: true })
      .click()
    const freeze = admin.getByRole('dialog', {
      name: 'Confirm freeze wallet',
      exact: true,
    })
    await expect(
      freeze.getByText(customerEmail, { exact: false })
    ).toBeVisible()
    await expect(
      freeze.getByText(/New deposits, transfers, payments and refunds/)
    ).toBeVisible()
    await freeze
      .getByRole('button', { name: 'Confirm freeze wallet', exact: true })
      .click()
    await expect(
      freeze.getByText('Enter a reason.', { exact: true })
    ).toBeVisible()
    let adminAttempts = 0
    const adminStates: unknown[] = []
    await admin.route('**/api/v1/admin/wallets/*/status', async (route) => {
      adminAttempts++
      adminStates.push(route.request().postDataJSON())
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      if (adminAttempts === 1) await route.abort('failed')
      else await route.fulfill({ response })
    })
    await freeze.getByLabel('Reason').fill('Investigating demo wallet activity')
    await freeze
      .getByRole('button', { name: 'Confirm freeze wallet', exact: true })
      .click()
    await expect(
      freeze.getByText('Unable to complete request', { exact: true })
    ).toBeVisible()
    await expect(
      freeze.getByRole('heading', {
        name: 'Confirm freeze wallet',
        exact: true,
      })
    ).toBeVisible()
    await freeze
      .getByRole('button', { name: 'Confirm freeze wallet', exact: true })
      .click()
    await expect(freeze).not.toBeVisible()
    expect(adminStates).toHaveLength(2)
    expect(adminStates[1]).toEqual(adminStates[0])
    await admin.unroute('**/api/v1/admin/wallets/*/status')
    await expect(
      walletDetails.getByText('Investigating demo wallet activity', {
        exact: true,
      })
    ).toBeVisible()
    await expect(
      walletDetails.getByText('ACTIVE → FROZEN', { exact: true })
    ).toBeVisible()
    await expect(walletDetails.getByText(/1 change ·/)).toBeVisible()
    await customer.reload()
    await expect(
      customer.getByText('Outcome unknown', { exact: true })
    ).toBeVisible()
    expect(attempts).toBe(1)
    await customer
      .getByRole('button', { name: 'Retry original request', exact: true })
      .click()
    await expect(
      customer.getByText('Operation confirmed.', { exact: true })
    ).toBeVisible()
    expect(attempts).toBe(2)
    expect(keys[1]).toBe(keys[0])
    await customer.unroute('**/api/v1/wallet/deposit')
    await customer
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await expect(
      customer.getByText('Wallet frozen', { exact: true })
    ).toBeVisible()
    await expect(
      customer.getByText('NPR 100.00', { exact: true }).first()
    ).toBeVisible()
    await customer.getByRole('button', { name: 'Add demo funds' }).click()
    await customer.getByLabel('Amount (NPR)').fill('1.00')
    await customer
      .getByRole('button', { name: 'Add funds', exact: true })
      .click()
    await expect(
      customer.getByText('Wallet is frozen.', { exact: true })
    ).toBeVisible()
    await customer
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await customer.goto('/transactions')
    await expect(
      customer.getByText('+ NPR 100.00', { exact: true }).first()
    ).toBeVisible()

    // Suspension rejects the existing session and login. Reactivation requires login,
    // preserves freezing, then unfreezing permits fresh funding again.
    await walletDetails
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await admin.getByRole('tab', { name: 'Accounts', exact: true }).click()
    await admin
      .getByRole('button', {
        name: `View account ${customerEmail}`,
        exact: true,
      })
      .click()
    await details
      .getByRole('button', { name: 'Suspend account', exact: true })
      .click()
    await suspend.getByLabel('Reason').fill('Account review')
    await suspend
      .getByRole('button', { name: 'Confirm suspend account', exact: true })
      .click()
    await expect(
      details.getByText('Account review', { exact: true })
    ).toBeVisible()
    await customer.reload()
    await expect(customer).toHaveURL(/\/login/)
    await customer.getByLabel('Email address').fill(customerEmail)
    await customer.getByLabel('Password', { exact: true }).fill(password)
    await customer.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(
      customer.getByText('Invalid email or password.', { exact: true }).first()
    ).toBeVisible()
    await details
      .getByRole('button', { name: 'Reactivate account', exact: true })
      .click()
    const reactivate = admin.getByRole('dialog', {
      name: 'Confirm reactivate account',
      exact: true,
    })
    await expect(
      reactivate.getByText(/Old sessions remain revoked/)
    ).toBeVisible()
    await reactivate.getByLabel('Reason').fill('Account review complete')
    await reactivate
      .getByRole('button', { name: 'Confirm reactivate account', exact: true })
      .click()
    await expect(
      details.getByText('Account review complete', { exact: true })
    ).toBeVisible()
    await customer.reload()
    await expect(customer).toHaveURL(/\/login/)
    await signIn(customer, customerEmail)
    await customer.goto('/wallet')
    await expect(
      customer.getByText('Wallet frozen', { exact: true })
    ).toBeVisible()
    await details.getByRole('button', { name: 'Close', exact: true }).click()
    await admin.getByRole('tab', { name: 'Wallets', exact: true }).click()
    await admin
      .getByRole('button', {
        name: `View wallet ${customerEmail}`,
        exact: true,
      })
      .click()
    await walletDetails
      .getByRole('button', { name: 'Unfreeze wallet', exact: true })
      .click()
    const unfreeze = admin.getByRole('dialog', {
      name: 'Confirm unfreeze wallet',
      exact: true,
    })
    await unfreeze.getByLabel('Reason').fill('Wallet review complete')
    await unfreeze
      .getByRole('button', { name: 'Confirm unfreeze wallet', exact: true })
      .click()
    await expect(
      walletDetails.getByText('Wallet review complete', { exact: true })
    ).toBeVisible()
    await expect(
      walletDetails.getByText('FROZEN → ACTIVE', { exact: true })
    ).toBeVisible()
    await customer.reload()
    await expect(
      customer.getByText('Wallet frozen', { exact: true })
    ).not.toBeVisible()
    await customer.getByRole('button', { name: 'Add demo funds' }).click()
    await customer.getByLabel('Amount (NPR)').fill('1.00')
    await customer
      .getByRole('button', { name: 'Add funds', exact: true })
      .click()
    await expect(
      customer.getByText('Operation confirmed.', { exact: true })
    ).toBeVisible()
    await customer
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await expect(
      customer.getByText('NPR 101.00', { exact: true }).first()
    ).toBeVisible()
    await customer.goto('/admin')
    await expect(
      customer.getByText('Access denied', { exact: true })
    ).toBeVisible()
    await expect(
      customer.getByRole('link', { name: 'Administration', exact: true })
    ).not.toBeVisible()
    await walletDetails
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await admin.getByRole('tab', { name: 'Accounts', exact: true }).click()
    await admin
      .getByRole('button', { name: `View account ${adminEmail}`, exact: true })
      .click()
    await expect(
      details.getByText('You cannot suspend your own account.', { exact: true })
    ).toBeVisible()
    await expect(
      details.getByRole('button', { name: 'Suspend account', exact: true })
    ).not.toBeVisible()
  } finally {
    await adminContext.close()
    await customerContext.close()
  }
})
