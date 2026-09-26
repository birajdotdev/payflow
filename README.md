# PayFlow

PayFlow is a learning and portfolio project for a digital wallet using simulated
NPR funds. The backend uses Java 21, Spring Boot 4.1, PostgreSQL, Spring Data JPA,
Flyway, and Spring Security. The planned frontend is Next.js.

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
- Wallet row locks and persistent idempotency keys protect concurrent requests and retries.
- Request validation and consistent JSON success/error responses.
- PostgreSQL JDBC error details are suppressed to keep conflicting field values out
  of application error logs.
- Integration tests run against disposable PostgreSQL containers.
- GitHub Actions builds, tests, and packages the backend.

Transfers, financial transaction history APIs, and the frontend are not
implemented yet. Register first, then log in to receive an access token. Routes
outside registration, login, current user/wallet, deposits, and API documentation are denied.

See the [PRD](docs/PRD.md) for the intended product scope.

## Prerequisites

- Java 21
- Docker with the Compose plugin, running and accessible to your user
- Internet access on the first build to download Maven dependencies and container images

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

## Register an account

```bash
curl -i http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
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

## Login and access your wallet

```bash
curl -sS http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
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

Tokens use HS256 and contain a user UUID, issuer, audience, issuance/not-before/
expiry times, a unique token ID, and the role at issuance. The decoder requires a
valid signature, the configured issuer/audience, a UUID subject, and valid timestamps,
with no expiry grace period. Authorization uses the current database role instead of
trusting the role snapshot in a token. Passwords and contact details are not JWT claims.

The API is stateless: it does not authenticate with cookies or HTTP sessions, and
tokens in query parameters are not accepted. Refresh tokens and server-side logout
are not implemented; log in again after expiry. Changing `JWT_SECRET` invalidates
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

Future money-changing operations must follow the same locking discipline; transfers
will need consistent ordering when locking two wallets. This milestone establishes
deposit correctness, not transfer correctness.

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

`verify` also packages an executable JAR in `backend/target/`. CI runs the same
command on a Docker-enabled GitHub-hosted runner.

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

1. Transfers with consistent wallet lock ordering, duplicate protection, and
   rollback/concurrent-spending tests.
2. Paginated transaction history and transaction details.
3. Minimal Next.js workflow, backend container, and complete Compose setup.

Merchant payments, refunds, admin tooling, and cloud deployment follow the stable MVP.
