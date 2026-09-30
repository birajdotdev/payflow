# PayFlow frontend

The frontend is a React 19 and TypeScript SPA using TanStack Router for file-based
browser routing, Tailwind CSS and shadcn/ui for styling, and Vite+ for development,
formatting (Oxfmt), linting (Oxlint), TypeScript checks, tests (Vitest), and builds.
The first feature includes registration, login, a protected dashboard and wallet,
refresh-cookie session restoration, logout, and the existing theme support.

Spring Boot owns authentication, authorization, validation, balances, transactions,
and persistence. TanStack Query owns API queries and mutations; TanStack Form and
Zod manage forms; one Axios instance handles transport, CSRF, bearer headers, and
bounded refresh retries. Monetary JSON values are parsed as decimal strings to
preserve BigDecimal precision. Access tokens live only in memory. Private queries
are scoped to the signed-in user and cleared on logout or session rejection.

Implemented routes: `/`, `/register`, `/login`, `/dashboard`, and `/wallet`.
The dashboard shows the real wallet balance and five recent transactions.
Deposits, transfers, full history, and profile screens are later features.

## Local development

Use Node.js 24 and Vite+ (`vp`). The project pins pnpm 12.8.1 in `package.json` and
toolchain versions in `pnpm-workspace.yaml` and `pnpm-lock.yaml`.

Run all frontend commands from `frontend/`:

```bash
vp install --frozen-lockfile
vp run dev
```

Open <http://localhost:3000>. Backend setup is in the [root README](../README.md).
The development proxy forwards `/api` to <http://localhost:8080>, preserving the
complete path and browser Origin. Start Spring Boot with these local HTTP overrides:

```bash
# From the repository root, after configuring .env as described in the root README:
set -a
source .env
set +a
export SESSION_COOKIE_SECURE=false
export SESSION_TRUSTED_ORIGINS=http://localhost:3000
cd backend
./mvnw spring-boot:run
```

Use the local cookie override only for HTTP development. Production requires secure
cookies and its exact trusted frontend origin. `DB_URL` must be a JDBC PostgreSQL
URL, and `JWT_SECRET` must decode to at least 32 bytes.

The API base defaults to `/api/v1`. `.env.example` documents the optional public
`VITE_API_BASE_URL` build-time override; use only your trusted PayFlow API origin.
Separate-origin deployments require the backend's credentialed CORS configuration.

Register creates an account and wallet, then directs you to sign in. Reloading a
protected route uses one shared refresh request. Login return destinations are
restricted to the implemented protected routes. Only definitive protected GET 401s
can refresh and retry once. Network failures, 403s, and server failures do not
start refresh loops. No mutation is automatically replayed. If server logout
cannot be confirmed, the sign-in page explains that local state was cleared and
offers a revocation retry.

## Route generation

Routes live in `src/routes/`; `__root.tsx` renders the shared layout with `Outlet`.
TanStack Router generates `src/routeTree.gen.ts` during development and builds.
Generate it explicitly before standalone checks:

```bash
vp run generate-routes
```

Do not hand-edit the generated tree. `tsr.config.json` is shared by the router CLI
and Vite plugin and configures single quotes and no semicolons. The generated tree
is excluded from formatting and linting in `vite.config.ts`, so regeneration does
not conflict with source formatting. The router plugin runs before the React
plugin and enables automatic route code splitting.

## Checks, tests, and builds

Run the same sequence as frontend CI:

```bash
vp install --frozen-lockfile
vp run generate-routes
vp check
vp test run
vp build
```

`vp check` is the built-in formatting, lint, and TypeScript check. `vp run check`
invokes the package script, which only checks formatting. Use `vp run format` to
apply formatting and lint fixes to source files.

Vitest tests cover form validation/submission, redirect sanitization, decimal
precision, error normalization, bearer/CSRF/cookie configuration, restoration,
concurrent refresh, bounded retries, private-cache clearing, and stale responses.
The forms use React Testing Library with jsdom.

For a real API smoke check: register a unique email/phone, sign in, verify the
zero-balance dashboard, open `/wallet`, reload to verify restoration, log out,
then reload `/wallet` and verify sign-in with no wallet data. Check both desktop
and mobile viewports. This flow was verified against the local Spring Boot API;
an automated production-hosting browser suite remains future work.

## Static build and hosting

`vp build` writes static assets to `dist/`. Inspect the build locally with:

```bash
vp preview
```

Production hosting must serve `dist/`, provide SPA fallback to `index.html` for
application routes, and proxy `/api/*` to Spring Boot. API requests and missing
assets must not receive SPA HTML. The production static-server configuration and
deep-link/API browser checks are still planned. `vp preview` is for local
inspection; production uses a static web server.
