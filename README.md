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
- Request validation and consistent JSON success/error responses.
- PostgreSQL JDBC error details are suppressed to keep conflicting field values out
  of application error logs.
- Integration tests run against disposable PostgreSQL containers.
- GitHub Actions builds, tests, and packages the backend.

Login/JWT issuance, authenticated wallet access, deposits, transfers, financial
transaction history, and the frontend are not implemented yet. The resource-server
dependency is present for the next authentication milestone; registration does not
issue a token. All routes other than registration and API documentation are denied.

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
| 401 | `UNAUTHORIZED` | Request to a closed route without authentication |
| 500 | `INTERNAL_ERROR` | Unexpected failure; registration is rolled back |

Conflict responses use the same message for email and phone and never identify the
conflicting field. A 409 still reveals that the submitted combination cannot be
registered; this is not an account-enumeration-proof signup flow.

## Test and build

From `backend/`:

```bash
./mvnw verify
```

No `.env`, manually started PostgreSQL, or `DB_*` variables are needed for tests.
Spring Boot manages a PostgreSQL 18.6 Testcontainers bean and supplies its connection
details. Tests apply the real Flyway migrations to an isolated database on a random
port. They do not connect to or clear the development database.

The suite covers registration defaults and hashing, duplicate email/phone,
case-insensitive database uniqueness, concurrent duplicate registration, validation
(including multibyte password limits), privilege/balance input, closed routes,
OpenAPI generation, and transaction rollback. The rollback test installs a temporary
database trigger that rejects wallet insertion, then checks that the user insert
was rolled back while existing accounts remain intact.

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

The wallet already has a nonnegative balance constraint and an optimistic version
column. Money movement and its concurrency strategy are still to be implemented;
registration tests do not establish transfer correctness.

Next milestones:

1. Login with JWT issuance/validation, `/auth/me`, and ownership-protected `/wallet`.
2. Financial records and simulated deposits with atomicity and idempotency.
3. Transfers with consistent wallet lock ordering, duplicate protection, and
   rollback/concurrent-spending tests.
4. Paginated transaction history and transaction details.
5. Minimal Next.js workflow, backend container, and complete Compose setup.

Merchant payments, refunds, admin tooling, and cloud deployment follow the stable MVP.
