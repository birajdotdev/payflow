# PayFlow frontend

Next.js App Router UI for registration, login, and the authenticated NPR wallet.
The existing shadcn/Base UI auth cards and dashboard shell form the visual base.

## Local development

Use Node.js 24+ and pnpm 12.6.0. Start Spring Boot and PostgreSQL using the root
README, then from this directory:

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. `PAYFLOW_API_URL` is the server-only backend origin
(default `http://localhost:8080`). `APP_ORIGIN` must exactly match the browser-facing
origin (default `http://localhost:3000`), including the port. Set both when using
a different host or port. Production deployments require HTTPS.

Routes: `/` → `/signup` → `/login` → `/dashboard`.
Registration does not automatically log in. A new wallet starts at NPR 0.00.
Deposit, transfer, and transaction-history interfaces come in later milestones.

## Authentication and data flow

Browser → Next.js Server Actions/server components → Spring Boot REST API.

- Spring Boot owns authentication, authorization, and all financial rules.
- Next.js validates form payloads again on the server and exposes safe errors.
- JWTs are stored in a host-only HttpOnly, SameSite=Lax cookie, Secure in production,
  with the backend expiry. Only the Next.js server forwards bearer tokens.
- Mutating actions use Next.js origin checks plus an exact `APP_ORIGIN` check,
  including rejecting requests with no Origin. Do not broadly allow external origins.
- Private reads use `cache: "no-store"` behind Suspense boundaries. Existing Cache
  Components and Partial Prefetching remain enabled for static shells; wallet/user
  data does not use a cache directive.
- Login/logout invalidate routes and perform full document navigation. A storage
  change signal refreshes other open dashboard tabs; no credentials go into storage.
- The dashboard rechecks the session after hydration and on window focus to cover
  auth changes that occur before listeners attach. This intentionally adds a read
  after the first render. It leaves the page at token expiry and refreshes restored browser
  history pages. Spring Boot still validates tokens and current account status on reads.
- Logout clears the browser cookie; issued JWTs are not revoked server-side.
  Refresh tokens are outside this milestone.
- Backend outages preserve the session and show a retryable error.

`AuthForm` owns validation presentation, accessible fields, and pending state.
`LoginForm`/`SignupForm` own action results and navigation. Server-only API and
session helpers live under `src/lib/api` and `src/lib/auth`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Browser tests require Docker, Java 21, and a packaged backend:

```bash
(cd ../backend && ./mvnw --batch-mode -DskipTests package)
pnpm exec playwright install chromium
pnpm test:e2e
```

The test harness runs a disposable `postgres:18.6` container with a random mapped
port and fresh credentials, the real Spring Boot JAR, a loopback fault-injection
proxy, and the production Next.js build. It never sources `.env` or uses the
development database. Ports 13000, 18080, and 18081 must be free. The harness stops
its processes and removes its container when tests finish. Run `pnpm build` again
when application code changes before rerunning browser tests.

Tests cover signup, safe errors, accessible validation, real wallet balances,
cookie flags, refresh, logout, account switching, expiry/forged tokens, outages,
CSRF rejection, keyboard navigation, and the mobile sidebar. Traces on failure
contain only disposable test accounts; keep them out of Git.

The frontend GitHub Actions workflow runs these checks. The separate backend
workflow runs the full PostgreSQL integration suite.
