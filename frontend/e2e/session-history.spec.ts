import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const user = {
  userId: 'user-1',
  fullName: 'Session User',
  email: 'session@example.com',
  phone: '+9779800000000',
  role: 'USER',
  status: 'ACTIVE',
}
async function fixture(page: Page) {
  const state = {
    expired: false,
    revoked: false,
    refreshes: 0,
    tokens: [] as string[],
    queries: [] as URLSearchParams[],
  }
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } })
    if (path.endsWith('/auth/refresh') || path.endsWith('/auth/login')) {
      if (path.endsWith('/refresh')) state.refreshes++
      if (state.revoked && path.endsWith('/refresh'))
        return route.fulfill({
          status: 401,
          json: { message: 'Session expired' },
        })
      state.expired = false
      return ok({
        user,
        accessToken: `token-${state.refreshes}`,
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: '2030-01-01T00:00:00Z',
      })
    }
    state.tokens.push(route.request().headers()['authorization'])
    if (state.expired)
      return route.fulfill({
        status: 401,
        json: { message: 'Access token expired' },
      })
    if (path.endsWith('/auth/me')) return ok(user)
    if (path.endsWith('/wallet'))
      return ok({
        walletId: '11111111-1111-4111-8111-111111111111',
        balance: '100.00',
        currency: 'NPR',
        status: 'ACTIVE',
      })
    if (path.endsWith('/transactions')) {
      const params = new URL(route.request().url()).searchParams
      state.queries.push(params)
      const pageIndex = Number(params.get('page')),
        size = Number(params.get('size'))
      return ok({
        content: Array.from({ length: size }, (_, i) => ({
          transactionId: `${pageIndex}-${i}`,
          reference: `PAGE-${pageIndex}-ROW-${i}`,
          type: params.get('type') ?? 'DEPOSIT',
          status: params.get('status') ?? 'SUCCESS',
          amount: '10.00',
          currency: 'NPR',
          senderWalletId: null,
          receiverWalletId: '11111111-1111-4111-8111-111111111111',
          description: null,
          createdAt: '2026-09-01T00:00:00Z',
        })),
        totalElements: 12,
        totalPages: Math.ceil(12 / size),
        page: pageIndex,
        size,
        hasNext: true,
      })
    }
    return route.fulfill({ status: 404, json: { message: 'Missing fixture' } })
  })
  return state
}
test('profile revalidates and expired access token renews once', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.goto('/profile')
  await expect(
    page.getByRole('heading', { name: 'Your profile' })
  ).toBeVisible()
  await expect(page.getByText(user.phone, { exact: true })).toBeVisible()
  expect(state.refreshes).toBe(1)
  state.expired = true
  await page.getByRole('link', { name: 'Transactions', exact: true }).click()
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
  expect(state.refreshes).toBe(2)
  expect(state.tokens).toContain('Bearer token-2')
})
test('expired session returns to history search after login', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.goto('/transactions?page=1&size=5&type=DEPOSIT')
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  state.expired = true
  state.revoked = true
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  const target = new URL(page.url()).searchParams.get('redirect')!
  expect(target).toContain('/transactions')
  expect(target).toContain('page=1')
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toHaveCount(0)
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('Password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('page')).toBe('1')
})
test('history filters and pagination survive back and forward', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.goto('/transactions?page=0&size=5')
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Rows per page' }).click()
  await page.getByRole('option', { name: '20', exact: true }).click()
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('combobox', { name: 'Rows per page' })
  ).toContainText('5')
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('combobox', { name: 'Type', exact: true }).click()
  await page.getByRole('option', { name: 'Transfer', exact: true }).click()
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'Completed', exact: true }).click()
  await page.getByLabel('From date', { exact: true }).fill('2026-09-01T00:00')
  await page.getByLabel('To date', { exact: true }).fill('2026-09-30T00:00')
  await expect
    .poll(() => state.queries.at(-1)?.get('toDate'))
    .toBe('2026-09-30T00:00:00.000Z')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(
    page.getByRole('combobox', { name: 'Type', exact: true })
  ).toContainText('All types')
  await page.goBack()
  await expect(
    page.getByRole('combobox', { name: 'Type', exact: true })
  ).toContainText('Transfer')
  await expect(
    page.getByRole('combobox', { name: 'Status', exact: true })
  ).toContainText('Completed')
  await expect(page.getByLabel('From date', { exact: true })).toHaveValue(
    '2026-09-01T00:00'
  )
  await expect(page.getByText('PAGE-1-ROW-0', { exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByLabel('From date', { exact: true })).toHaveValue('')
  await expect(page.getByText('PAGE-0-ROW-0', { exact: true })).toBeVisible()
})

test('expired startup session preserves the profile return destination', async ({
  page,
}) => {
  const state = await fixture(page)
  state.revoked = true
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/profile')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('Password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Your profile' })
  ).toBeVisible()
})
