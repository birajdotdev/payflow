import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID, randomInt, createHmac } from "node:crypto";
const api = "http://127.0.0.1:18080/api/v1";
const fault = "http://127.0.0.1:18081/__test/failure";
function account() {
  return {
    fullName: `Wallet User ${randomUUID().slice(0, 8)}`,
    email: `${randomUUID()}@example.com`,
    phone: `+9779${randomInt(100000000, 999999999)}`,
    password: "demo passphrase",
  };
}
async function createAccount(request: APIRequestContext) {
  const user = account();
  const response = await request.post(`${api}/auth/register`, { data: user });
  expect(response.status()).toBe(201);
  const { data } = await response.json();
  return { ...user, walletId: data.walletId as string };
}
async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}
test.beforeEach(async ({ request }) => {
  await request.post(fault, { headers: { "x-test-failure": "off" } });
});
test.afterEach(async ({ request }) => {
  await request.post(fault, { headers: { "x-test-failure": "off" } });
});

test("signup, private cookie, real wallet, refresh, copy, logout and back navigation", async ({
  page,
  context,
}, testInfo) => {
  const user = account();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/signup");
  await expect(page.getByLabel("Full Name", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("signup-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("Full Name", { exact: true }).fill(user.fullName);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Phone Number", { exact: true }).fill(user.phone);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await expect(page.getByRole("status")).toContainText("Account created");
  await login(page, user);
  await expect(
    page.getByRole("heading", { name: `Welcome, ${user.fullName}` })
  ).toBeVisible();
  await expect(page.getByTestId("wallet-balance")).toHaveText("NPR 0.00");
  await expect(page.getByTestId("wallet-balance")).toBeVisible();
  const cookie = (await context.cookies()).find(
    (item) => item.name === "payflow_session"
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "payflow_session"
  );
  expect(await page.content()).not.toContain(cookie?.value);
  await page.reload();
  await expect(page.getByTestId("wallet-balance")).toHaveText("NPR 0.00");
  await expect(page.getByTestId("wallet-id")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-desktop.png"),
    fullPage: true,
  });
  const walletId = await page.getByTestId("wallet-id").innerText();
  await page.getByRole("button", { name: "Copy wallet ID" }).click();
  await expect(page.getByRole("status")).toHaveText("Wallet ID copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    walletId
  );
  await logout(page);
  expect(
    (await context.cookies()).some((item) => item.name === "payflow_session")
  ).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByTestId("wallet-id")).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?session=expired$/);
  await expect(page.getByText(user.fullName)).toHaveCount(0);
});

test("accessible validation and safe authentication/conflict errors", async ({
  page,
  request,
}) => {
  const user = await createAccount(request);
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "signup-form-fullName-error"
  );
  await page.getByText("Full Name", { exact: true }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toBeFocused();
  await page.getByLabel("Full Name", { exact: true }).fill(user.fullName);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Phone Number", { exact: true }).fill(user.phone);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "An account could not be created"
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Email or password is incorrect"
  );
});

test("different users see their own real balances and wallet IDs", async ({
  page,
  context,
  request,
}) => {
  const alice = await createAccount(request);
  const bob = await createAccount(request);
  await login(page, alice);
  const token = (await context.cookies()).find(
    (cookie) => cookie.name === "payflow_session"
  )?.value;
  const deposit = await request.post(`${api}/wallet/deposit`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: { amount: 1250.25 },
  });
  expect(deposit.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId("wallet-balance")).toHaveText("NPR 1,250.25");
  await expect(page.getByTestId("wallet-id")).toHaveText(alice.walletId);
  await logout(page);
  await login(page, bob);
  await expect(page.getByTestId("wallet-id")).toHaveText(bob.walletId);
  await expect(page.getByTestId("wallet-balance")).toHaveText("NPR 0.00");
  await expect(page.getByText(alice.fullName)).toHaveCount(0);
});

test("expiry leaves the dashboard and forged tokens cannot read wallets", async ({
  page,
  context,
  request,
}) => {
  const user = await createAccount(request);
  await login(page, user);
  const cookie = (await context.cookies()).find(
    (item) => item.name === "payflow_session"
  );
  expect(cookie).toBeDefined();
  const [header, body] = cookie!.value.split(".");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  payload.exp = Math.floor(Date.now() / 1000) + 5;
  const content = `${header}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const signature = createHmac(
    "sha256",
    Buffer.from(process.env.E2E_JWT_SECRET!, "base64")
  )
    .update(content)
    .digest("base64url");
  await context.addCookies([{ ...cookie!, value: `${content}.${signature}` }]);
  await page.reload();
  await expect(page.getByTestId("wallet-id")).toHaveText(user.walletId);
  await expect(page).toHaveURL(/\/login\?session=expired$/, {
    timeout: 15_000,
  });
  payload.exp = Math.floor(Date.now() / 1000) + 600;
  await context.addCookies([
    {
      ...cookie!,
      value: `${header}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.invalid`,
    },
  ]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?session=expired$/);
});

test("outages preserve the session and recovery works", async ({
  page,
  context,
  request,
}) => {
  const user = await createAccount(request);
  await login(page, user);
  await request.post(fault, { headers: { "x-test-failure": "on" } });
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Your wallet is temporarily unavailable",
    })
  ).toBeVisible();
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "payflow_session"
    )
  ).toBe(true);
  await request.post(fault, { headers: { "x-test-failure": "off" } });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("wallet-id")).toHaveText(user.walletId);
  await logout(page);
  await request.post(fault, { headers: { "x-test-failure": "on" } });
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "PayFlow is unavailable"
  );
});

test("cross-origin and missing-origin action submissions are rejected", async ({
  page,
  request,
}) => {
  const user = await createAccount(request);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  const actionRequest = page.waitForRequest(
    (req) => req.method() === "POST" && Boolean(req.headers()["next-action"])
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const original = await actionRequest;
  await expect(page).toHaveURL(/\/dashboard$/);
  const headers = {
    "next-action": original.headers()["next-action"],
    "content-type": original.headers()["content-type"],
  };
  const rejected = await request.post("/login", {
    headers: { ...headers, origin: "https://untrusted.example" },
    data: original.postData()!,
  });
  expect(rejected.status()).toBeGreaterThanOrEqual(400);
  expect(rejected.headers()["set-cookie"]).toBeUndefined();
  const missing = await request.post("/login", {
    headers,
    data: original.postData()!,
  });
  expect(await missing.text()).toContain("Unable to submit this request");
  expect(missing.headers()["set-cookie"]).toBeUndefined();
});

test("mobile layout, keyboard login, password toggle and sidebar logout", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = await createAccount(request);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.type(user.email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type(user.password);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text"
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("wallet-balance")).toHaveText("NPR 0.00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await expect(page.getByTestId("wallet-id")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await logout(page);
});

test("pending submission stays disabled until the response arrives", async ({
  page,
  request,
}) => {
  const user = await createAccount(request);
  await page.goto("/login");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route("**/login", async (route) => {
    if (route.request().method() === "POST") {
      submissions++;
      await gate;
    }
    await route.continue();
  });
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Signing in…" })
  ).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).press("Enter");
  expect(submissions).toBe(1);
  release();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("other open tabs refresh when the account changes or logs out", async ({
  page,
  context,
  request,
}) => {
  const alice = await createAccount(request);
  const bob = await createAccount(request);
  await login(page, alice);
  const other = await context.newPage();
  await other.goto("/dashboard");
  await expect(other.getByTestId("wallet-id")).toBeVisible();
  await expect(other.getByTestId("wallet-id")).toHaveText(alice.walletId);
  await login(page, bob);
  await expect(other.getByTestId("wallet-id")).toHaveText(bob.walletId);
  await logout(page);
  await expect(other).toHaveURL(/\/login\?session=expired$/);
  await other.close();
});
