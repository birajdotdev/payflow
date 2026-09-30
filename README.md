# PayFlow

PayFlow is a learning and portfolio project for a digital wallet using simulated
NPR funds. The backend uses Java 21, Spring Boot 4.1, PostgreSQL, Spring Data JPA,
Flyway, and Spring Security. The frontend is a React and TypeScript SPA scaffold
using TanStack Router, Vite+, Tailwind CSS, and shadcn/ui.

## Current status

Implemented:

- Registration creates a USER account and one ACTIVE wallet with NPR 0.00.
- User and wallet creation commit together or both roll back.
- Passwords are hashed with BCrypt and never included in API responses.
- PostgreSQL enforces unique phone numbers and case-insensitive email identity,
  including concurrent registration requests.
- Login issues signed JWT access tokens; `/api/v1/auth/me` returns the current user.
- `/api/v1/wallet` returns only the authenticated user's primary wallet.
- Protected requests check the current account status and role in PostgreSQL.
- Simulated deposits atomically credit the wallet and create a financial transaction.
- Wallet transfers atomically debit the sender, credit the receiver, and record one transfer.
- Paginated transaction history and receipts are restricted to the authenticated wallet.
- Wallet row locks and persistent idempotency keys protect concurrent requests and retries.
- Request validation and consistent JSON success/error responses.
- PostgreSQL JDBC error details are suppressed to keep conflicting field values out
  of application error logs.
- Integration tests run against disposable PostgreSQL containers.
- GitHub Actions builds, tests, and packages the backend.

The frontend includes registration, login, protected dashboard/wallet views,
real API queries, refresh-cookie session restoration, and logout. Deposits and
transfers are implemented in the backend and await their frontend feature. The backend uses session-bound access JWTs and HttpOnly refresh cookies. Register through the API first,
then log in to receive an access token. API routes outside registration, login,
refresh/logout, current user/wallet, deposits, transfers, transaction history/details, and API
documentation are denied.

See the [PRD](docs/PRD.md) for the intended product scope.

## Prerequisites

- Java 21
- Docker with the Compose plugin, running and accessible to your user
- Internet access on the first build to download Maven dependencies and container images
- For the frontend: Node.js 24 and Vite+ (`vp`); the project pins pnpm 12.8.1

The Maven wrapper is included; a separate Maven installation is unnecessary.

## Run locally

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` before proceeding. `POSTGRES_DB`, `POSTGRES_USER`, and
`POSTGRES_PASSWORD` initialize the local database. Set `DB_URL`, `DB_USERNAME`, and
`DB_PASSWORD` to match those database settings; the backend uses the `DB_*` variables.
Keep passwords out of Git. For the shell commands below, quote values containing
shell metacharacters in your local `.env` file.

Generate a signing key with `openssl rand -base64 32` and put the result in
`JWT_SECRET` in `.env`. This variable is required; the backend refuses to start with
a missing key, invalid Base64, or fewer than 32 decoded bytes. If you already have
a `.env`, add the JWT settings from `.env.example` without overwriting your database
credentials.

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | Required | Base64-encoded random HS256 signing key, at least 32 bytes |
| `JWT_ISSUER` | `payflow` | Expected token issuer |
| `JWT_AUDIENCE` | `payflow-api` | Expected token audience |
| `JWT_ACCESS_TOKEN_TTL` | `15m` | Token lifetime, whole seconds between 1 second and 1 hour |

```bash
docker compose up -d --wait postgres
set -a
source .env
set +a
cd backend
./mvnw spring-boot:run
```

Compose reads `.env` automatically; Spring Boot does not. Exporting the variables
above makes them available to the backend, which runs on port 8080. Compose currently
starts only PostgreSQL. Flyway applies migrations at backend startup, and Hibernate
validates the schema instead of modifying it.

Database credentials in an existing PostgreSQL volume do not change when `.env`
changes. Use the credentials with which that volume was initialized.

- Swagger UI: <http://localhost:8080/swagger-ui/index.html>
- OpenAPI JSON: <http://localhost:8080/v3/api-docs>

Stop PostgreSQL with `docker compose stop` from the repository root; data stays in
the named volume.

### Frontend development

In a separate terminal, from the repository root:

```bash
cd frontend
vp install --frozen-lockfile
vp run dev
```

Open <http://localhost:3000>. The scaffold currently has no API proxy or shared API
client. See the [frontend README](frontend/README.md) for route generation, checks,
tests, and static build/hosting requirements.

## Register an account

```bash
curl -i http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -H 'X-PayFlow-CSRF: 1' \
  -H 'Origin: https://localhost' \
  -d '{
    "fullName": "Demo User",
    "email": "demo@example.com",
    "phone": "+9779812345678",
    "password": "Demo-password-123"
  }'
```

Returns HTTP 201:

```json
{
  "success": true,
  "data": {
    "userId": "<uuid>",
    "fullName": "Demo User",
    "email": "demo@example.com",
    "phone": "+9779812345678",
    "role": "USER",
    "walletId": "<uuid>"
  },
  "timestamp": "<UTC timestamp>"
}
```

Input rules:

- Full names are trimmed, nonblank, and at most 100 characters.
- Emails are trimmed, lowercased, validated, and at most 255 characters.
- Phone numbers are trimmed and must be `+` followed by 8–15 digits, starting with
  a nonzero digit. For Nepal, use a value such as `+9779812345678`. This checks format,
  not ownership or whether the number is assigned.
- Passwords are not trimmed. They must be nonblank, contain at least 8 Unicode code
  points, and fit within BCrypt's 72 UTF-8 byte limit.
- Role, account status, wallet currency, and starting balance are assigned by the
  server. They cannot be selected through this endpoint.

| HTTP status | Error code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Invalid fields or malformed JSON |
| 409 | `REGISTRATION_CONFLICT` | Email or phone conflicts with an existing account |
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired bearer authentication |
| 401 | `INVALID_CREDENTIALS` | Login credentials are incorrect or the account is unavailable |
| 403 | `FORBIDDEN` | Authenticated request to a denied operation |
| 500 | `INTERNAL_ERROR` | Unexpected failure; registration is rolled back |

Conflict responses use the same message for email and phone and never identify the
conflicting field. A 409 still reveals that the submitted combination cannot be
registered; this is not an account-enumeration-proof signup flow.

## Backend package organization

Java code under `com.payflow.backend` is grouped by business feature (`auth`, `user`,
`wallet`, `transfer`, `transaction`). Each feature uses `controller`, `service`,
`repository`, `entity`, and `dto` subpackages where needed. Entities and their domain
enums live together; authentication-specific security and validation remain under
`auth.security` and `auth.validation`. Application-wide configuration lives in
`config`, with shared errors and response envelopes in `common`.

See [PRD section 31](docs/PRD.md#31-backend-architecture) for the package tree and
responsibilities. Feature integration tests stay grouped by feature.

## Backend Java formatting

The backend uses Spring Java Format with spaces for indentation. Maven's `validate`
phase checks formatting, including during CI's `verify` build. From `backend/`, run:

```bash
./mvnw spring-javaformat:apply    # Format main and test Java sources
./mvnw spring-javaformat:validate # Check formatting without changing files
```

Use explicit imports and simple type names in declarations; the formatter handles
spacing and wrapping, while imports must be maintained separately.

## Login and access your wallet

```bash
curl -sS http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-PayFlow-CSRF: 1' \
  -H 'Origin: https://localhost' \
  -d '{"email":"demo@example.com","password":"Demo-password-123"}'
```

The HTTP 200 response contains `data.accessToken`, `data.tokenType` (`Bearer`),
`data.expiresIn` (seconds), `data.expiresAt` (UTC), and `data.user` (profile and role).
Login uses the same email normalization and password format rules as registration.
Wrong passwords, unknown emails, and suspended accounts all return the same generic
401 response. A dummy BCrypt check is performed for unknown emails as well.

Use the returned access token for both protected endpoints. In Bash, this reads
the token without echoing it or putting its literal value in shell history:

```bash
read -r -s -p 'Access token: ' PAYFLOW_ACCESS_TOKEN
curl -sS http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer $PAYFLOW_ACCESS_TOKEN"
curl -sS http://localhost:8080/api/v1/wallet \
  -H "Authorization: Bearer $PAYFLOW_ACCESS_TOKEN"
unset PAYFLOW_ACCESS_TOKEN
```

The wallet response includes `walletId`, `balance`, `currency`, `status`,
`createdAt`, and `updatedAt`. The owner is always obtained from authentication;
request parameters cannot select another user's wallet. A frozen wallet remains
readable. Account suspension prevents both login and subsequent use of issued tokens.

Swagger's **Authorize** button accepts the access token and attaches the bearer
header to protected operations.

Tokens use HS256 and contain a user UUID, session ID (`sid`), issuer, audience, issuance/not-before/
expiry times, a unique token ID, and the role at issuance. The decoder requires a
valid signature, the configured issuer/audience, a UUID subject, and valid timestamps,
with no expiry grace period. Authorization uses the current database role instead of
trusting the role snapshot in a token. Passwords and contact details are not JWT claims.

Business APIs require bearer tokens. Each JWT has a `sid`; every request checks the
session owner, deadlines, revocation and current account status/role in PostgreSQL.
Login creates a session and a 256-bit opaque token whose SHA-256 hash alone is stored.
`POST /api/v1/auth/refresh` restores access without a JWT and retains the same refresh
token. `POST /api/v1/auth/logout` revokes that session and clears its cookie, returning
`data: null`; subsequent access JWT checks reject the revoked session. Both accept no
body. Invalid refresh returns `401 UNAUTHORIZED` and clears the cookie.

All four authentication POST endpoints require `X-PayFlow-CSRF: 1` and an exact trusted
`Origin`, with parsed `Referer` origin fallback. Login/register require JSON. CSRF
failure returns `403 FORBIDDEN` before session changes. Business endpoints reject cookie-only
authentication. Authentication responses use `Cache-Control: no-store`.

Configure `SESSION_TRUSTED_ORIGINS` as comma-separated exact frontend origins (default
`https://localhost`), `SESSION_ABSOLUTE_TTL` (default `7d`), and `SESSION_IDLE_TTL`
(default `24h`). Refresh renews inactivity but never the absolute deadline; JWT expiry
is capped by the session deadline. Ordinary API requests do not renew sessions.
The host-only `payflow_refresh` cookie uses HttpOnly, Secure, SameSite=Strict and
Path=/api/v1/auth. For HTTP local development only, set `SESSION_COOKIE_SECURE=false`
and configure localhost/loopback trusted origins. Production must use secure cookies.
The default deployment is same-origin; separate-origin credentialed CORS is not enabled.
Strict rotation/reuse detection and cross-tab coordination remain deferred. Changing `JWT_SECRET` invalidates
all existing tokens. Keep the same key across restarts when tokens should remain valid.

## Add simulated funds

`POST /api/v1/wallet/deposit` requires a bearer token and an `Idempotency-Key` header.
The body accepts an `amount` in NPR; wallet ownership and currency come from the server.
All account roles with an active account may fund their own wallet.

```bash
read -r -s -p 'Access token: ' PAYFLOW_ACCESS_TOKEN
curl -sS http://localhost:8080/api/v1/wallet/deposit \
  -H "Authorization: Bearer $PAYFLOW_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-deposit-1000' \
  -d '{"amount":1000}'
```

Repeat the same command with the same key. Starting from zero, the wallet will still
have **NPR 1,000.00 and exactly one transaction record**. Use a new key for each intended
deposit; preserve the key when retrying after a timeout or server error. Unset
`PAYFLOW_ACCESS_TOKEN` when finished.

Both the initial request and a matching retry return HTTP 200 with `data` containing
`transactionId`, `reference`, `type` (`DEPOSIT`), `status` (`SUCCESS`), `walletId`,
`amount`, `currency` (`NPR`), `balanceAfter`, and `createdAt`. References use
`PF-<UTC year>-<UUID>` and have a database uniqueness constraint. The receipt's
`balanceAfter` is the balance immediately after that deposit, not the current balance.
A retry returns the original receipt even after later deposits or a wallet freeze;
the response envelope's `timestamp` reflects the current request. Use `GET /api/v1/wallet`
for the current balance.

Rules and errors:

| Rule | HTTP status / code |
|---|---|
| Amount must be NPR 0.01–100,000.00 inclusive, with at most two decimal places; no rounding | 400 / `INVALID_REQUEST` |
| Key is required, case-sensitive, 1–128 ASCII letters, digits, underscores or hyphens | 400 / `INVALID_REQUEST` |
| Same wallet and key with a different amount | 409 / `IDEMPOTENCY_CONFLICT` |
| New deposit into a frozen wallet | 409 / `WALLET_FROZEN` |
| Resulting simulated balance exceeds NPR 1,000,000.00 | 409 / `BALANCE_LIMIT_EXCEEDED` |
| Missing/invalid token or unavailable account | 401 / `UNAUTHORIZED` |

Amounts use `BigDecimal` and database `DECIMAL(19,2)`. Numerically equal valid amounts
such as `1000`, `1000.0`, and `1000.00` match on retries. An amount with more than two
decimal places, including `1.000`, is rejected. Failed validation or rolled-back
operations do not reserve a key.

### Atomicity, concurrency, and idempotency

`DepositService.deposit` owns one database transaction. It acquires a PostgreSQL
pessimistic write lock on the authenticated user's wallet **before** checking for
an existing deposit key. Concurrent deposits to that wallet serialize across threads
and application instances. Different wallets can proceed independently. After waiting,
a request sees the committed receipt or can proceed if the earlier request rolled back.
The lock remains held through balance update, financial record insertion, and commit.
The existing wallet version column also guards against stale ORM updates.

V3 creates the financial records table, including type/status checks, wallet foreign
keys, unique references, and a unique `(receiver_wallet_id, type, idempotency_key)`
constraint as an additional duplicate guard. Deposit receipts and keys persist together
without expiration; keys are scoped to the wallet and deposit operation, so two users
may independently use the same key. The validated amount is the entire caller-controlled
financial payload, and is compared directly rather than hashed. Transaction records
have no update/delete API. Failed deposits leave no partial financial record or balance
change; retries after database failures can succeed with the same key.

V4 replaces the deposit uniqueness constraint with a deposit-only unique index and
adds a sender-scoped transfer key index. This preserves deposit keys while allowing
different senders to use the same key when paying a common receiver.

## Transfer simulated funds

`POST /api/v1/transfers` requires bearer authentication and `Idempotency-Key`.
The sender is always the authenticated account's wallet. All active account roles
can transfer. For Alice's token and Bob's wallet UUID:

```bash
curl -sS http://localhost:8080/api/v1/transfers \
  -H "Authorization: Bearer $PAYFLOW_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: alice-to-bob-300' \
  -d '{"receiverWalletId":"<Bob wallet UUID>","amount":300,"description":"Dinner"}'
```

Starting with Alice's NPR 1,000 deposit and Bob's empty wallet, send this request
and repeat it with the same key and payload. Alice retains **NPR 700.00**, Bob has
**NPR 300.00**, and **one TRANSFER record** exists (in addition to the deposit).
`GET /api/v1/wallet` with each user's token returns their current balance.

The initial request and matching retries return HTTP 200. The stable `data` receipt
contains `transactionId`, `reference`, `type` (`TRANSFER`), `status` (`SUCCESS`),
`senderWalletId`, `receiverWalletId`, `amount`, `currency` (`NPR`), `description`,
and `createdAt`. The envelope timestamp reflects the current request.

| Rule | HTTP status / code |
|---|---|
| Receiver UUID required; amount NPR 0.01–1,000,000.00, at most two decimal places; optional description at most 255 characters | 400 / `INVALID_REQUEST` |
| Same key syntax as deposits; header required | 400 / `INVALID_REQUEST` |
| Sender and receiver are the same wallet | 400 / `SELF_TRANSFER` |
| Receiver does not exist | 404 / `WALLET_NOT_FOUND` |
| Sender cannot cover amount | 409 / `INSUFFICIENT_BALANCE` |
| Either wallet is frozen | 409 / `WALLET_FROZEN` |
| Receiver would exceed NPR 1,000,000.00 | 409 / `BALANCE_LIMIT_EXCEEDED` |
| Existing sender transfer key with different receiver, amount, or description | 409 / `IDEMPOTENCY_CONFLICT` |

Keys persist with the transfer and are scoped to the sender and transfer operation;
deposit keys are independent. Numerically equal valid amounts match. Descriptions
are compared exactly, including whitespace; omitted/null descriptions match each
other, while an empty string is distinct. A matching retry returns the original
receipt even after balances change or either wallet is frozen. Failed operations
leave no record or reserved key, so they can be retried after the cause is resolved.

`TransferService.transfer` owns a single database transaction. It looks up the
sender's wallet ID without loading a potentially stale balance, then locks both
wallet rows sequentially in Java UUID comparison order. Every transfer follows
this order, including opposite-direction requests. Locks are held through the
idempotency lookup, debit, credit, record insert, and commit. Deposits use the same
wallet row locks, so they serialize with transfers touching that wallet. Database
constraints additionally enforce distinct transfer wallets, positive bounded amounts,
valid keys, and unique `(sender_wallet_id, idempotency_key)` for transfers. Both
balances are flushed before recording the transfer; any insert failure rolls back
both balances, wallet versions/timestamps, and the transfer key.

## Transaction history and receipts

`GET /api/v1/transactions` lists only transactions where your wallet is the sender
or receiver. `GET /api/v1/transactions/{id}` returns a single receipt with the same
ownership restriction. Both endpoints require bearer authentication. These personal
endpoints apply the same wallet scope to USER, MERCHANT, and ADMIN accounts.

```bash
curl -sS --get http://localhost:8080/api/v1/transactions \
  -H "Authorization: Bearer $PAYFLOW_ACCESS_TOKEN" \
  --data-urlencode 'type=TRANSFER' \
  --data-urlencode 'status=SUCCESS' \
  --data-urlencode 'fromDate=2026-09-01T00:00:00Z' \
  --data-urlencode 'toDate=2026-10-01T00:00:00Z' \
  --data-urlencode 'page=0' --data-urlencode 'size=20'

curl -sS 'http://localhost:8080/api/v1/transactions/<transaction-uuid>' \
  -H "Authorization: Bearer $PAYFLOW_ACCESS_TOKEN"
```

Replace `<transaction-uuid>` with a receipt's `transactionId` before running the
second command. All history parameters are optional and combine with AND:

| Parameter | Meaning |
|---|---|
| `type` | `DEPOSIT`, `TRANSFER`, `MERCHANT_PAYMENT`, or `REFUND` |
| `status` | `PENDING`, `SUCCESS`, `FAILED`, or `REFUNDED` |
| `fromDate` | Inclusive ISO-8601 timestamp with timezone |
| `toDate` | Exclusive ISO-8601 timestamp with timezone; must follow `fromDate` |
| `page` | Zero-based nonnegative page, default 0; page × size cannot exceed 2,147,483,647 |
| `size` | 1–100, default 20 |

History returns HTTP 200 with `data.content` containing receipts, plus `data.page`,
`size`, `totalElements`, `totalPages`, and `hasNext`. Empty or out-of-range pages
have empty content; counts include only your transactions matching the filters.
Order is fixed: `createdAt DESC, transactionId DESC`, with the UUID breaking timestamp
ties. Offset pagination reflects current committed data; new transactions between
page requests can shift page boundaries.

The detail endpoint returns HTTP 200 with one receipt in `data`. Each receipt has
`transactionId`, `reference`, `type`, `status`, `senderWalletId`, `receiverWalletId`,
`amount`, `currency`, `description`, and `createdAt`. Deposits have no sender, and
optional descriptions can be null. Idempotency keys, account contact details, and
wallet balances are not exposed by these endpoints.

Invalid filters, date ranges, page values, or UUIDs return 400 / `INVALID_REQUEST`.
Missing transactions and transactions belonging to another wallet both return
404 / `TRANSACTION_NOT_FOUND`. Frozen wallets can read their history; suspended
accounts cannot authenticate. These endpoints cannot update financial records.

After the Alice/Bob transfer milestone, Alice's history shows her deposit and
outgoing transfer, Bob's shows the incoming transfer, and both can retrieve the
same transfer receipt. An unrelated account sees neither transaction and cannot
retrieve either receipt. Ownership predicates run in PostgreSQL before pagination
and counting, using the existing sender/receiver history indexes; no migration is
needed for these read endpoints.

## Test and build

From `backend/`:

```bash
./mvnw verify
```

No `.env`, manually started PostgreSQL, or `DB_*` variables are needed for tests.
Spring Boot manages a PostgreSQL 18.6 Testcontainers bean and supplies its connection
details. Tests apply the real Flyway migrations to an isolated database on a random
port. They do not connect to or clear the development database.
Tests activate the `test` profile, which supplies a public test-only JWT key from
test resources; no local signing secret is needed.

The suite covers registration defaults and hashing, duplicate email/phone,
case-insensitive database uniqueness, concurrent duplicate registration, validation
(including multibyte password limits), privilege/balance input, closed routes,
OpenAPI generation, and transaction rollback. The rollback test installs a temporary
database trigger that rejects wallet insertion, then checks that the user insert
was rolled back while existing accounts remain intact.

Authentication tests use real signed tokens through the HTTP security filter chain.
They cover login/profile/wallet, owner isolation, forged and expired tokens, missing
claims, wrong issuer/audience/algorithm, current role changes, suspended/deleted
accounts, safe errors, and secret configuration validation.

Deposit integration tests use real signed tokens and PostgreSQL row locks. They cover
NPR 1,000 plus retries, stable receipts, separate user key scopes, amount/key validation,
concurrent duplicates, conflicting concurrent payloads, distinct concurrent deposits,
balance limits, frozen wallets, and transaction-insert failure after flushing the balance.
The injected failure verifies balance, version, and update timestamp rollback, preservation
of existing records, and successful retry with the same key.

Transfer integration tests cover the Alice/Bob acceptance milestone, stable retries,
full-payload conflicts, sender/operation key scopes, validation, missing/self/frozen
wallets, insufficient funds, receiver balance limits, concurrent retries, competing
spends to different receivers, opposite-direction transfers, and database-insert
failure after flushing both balances. Rollback assertions include both wallet
versions and timestamps, existing records, and successful reuse of the failed key.

Transaction history tests verify Alice/Bob receipt visibility, unrelated and admin
account isolation, private-field exclusion, combined filters and date boundaries,
timezone offsets, stable ordering for timestamp ties, pagination/counts, invalid
input, authentication/suspension, frozen-wallet reads, and financial record immutability.

`verify` also packages an executable JAR in `backend/target/`. CI runs the same
command on a Docker-enabled GitHub-hosted runner.

Frontend CI runs the following sequence from `frontend/`:

```bash
vp install --frozen-lockfile
vp run generate-routes
vp check
vp test run
vp build
```

`vp check` runs formatting, lint, and TypeScript checks. The scaffold has no
frontend tests yet; Vitest currently allows an empty suite. The build produces
static assets in `frontend/dist/`.

## Design and next milestones

The backend is a modular monolith organized by feature. Controllers validate HTTP
input and return DTOs; application services coordinate repository operations.
`RegistrationService.register` owns the transaction boundary. Database uniqueness
constraints are authoritative, so simultaneous signup requests cannot create two
accounts with the same email or phone. V2 adds normalized email uniqueness without
changing the existing V1 migration. If an existing database contains emails that
collide after normalization, resolve those records before applying V2.

The wallet has a nonnegative balance constraint and an optimistic version column.
Deposits add pessimistic row locking as described above.

Next milestones:

1. React SPA workflows for registration, login, funding, transfers, and history,
   with TanStack Query/Form, Zod, Axios, and session restoration as specified
   in the PRD.
2. Backend container and complete Compose setup.

Merchant payments, refunds, admin tooling, and cloud deployment follow the stable MVP.

Authentication cookie examples (use HTTPS and the trusted frontend origin configured above):

```bash
# Save the login refresh cookie without exposing its value in JSON.
curl -sS -c payflow-cookies.txt https://localhost/api/v1/auth/login \
  -H 'Origin: https://localhost' -H 'X-PayFlow-CSRF: 1' \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Demo-password-123"}'
curl -sS -b payflow-cookies.txt -c payflow-cookies.txt -X POST \
  https://localhost/api/v1/auth/refresh \
  -H 'Origin: https://localhost' -H 'X-PayFlow-CSRF: 1'
curl -sS -b payflow-cookies.txt -c payflow-cookies.txt -X POST \
  https://localhost/api/v1/auth/logout \
  -H 'Origin: https://localhost' -H 'X-PayFlow-CSRF: 1'
```

Treat the local cookie jar as a credential and remove it after use.
