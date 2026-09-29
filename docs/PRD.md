# Product Requirements Document

## PayFlow — Digital Wallet & Payment Platform

**Document Version:** 1.2\
**Last Updated:** 2026-09-30\
**Product Type:** Fintech / Digital Wallet Platform  
**Primary Objective:** Portfolio and learning project demonstrating production-oriented Java Spring Boot backend development  
**Target Platform:** Web  
**Frontend:** React + TypeScript SPA, TanStack Router, Vite+ (Vite-based toolchain)\
**Backend:** Java 21 + Spring Boot  
**Database:** PostgreSQL  

**Architecture decision:** The browser renders the application and calls the Spring Boot REST API. Vite+ supplies frontend development, checks, tests, and production builds. Spring Boot owns authentication, authorization, business logic, and persistence. Sections 31–36 and 41 define the integration; section 55 tracks the transition from the existing scaffold.

---

# 1. Product Overview

PayFlow is a digital wallet and payment platform that allows users to maintain a simulated wallet balance, transfer money to other users, make payments to registered merchants, and review their transaction history.

The project is designed as a realistic fintech application rather than a basic CRUD system. Particular emphasis will be placed on:

- Transaction consistency
- Secure authentication and authorization
- Financial data integrity
- Idempotent payment processing
- Auditability
- Error handling
- Automated testing
- API design
- Deployment and DevOps practices

All financial activity in PayFlow will use simulated money. No real banking, card, or payment-gateway integration is required for the initial version.

---

# 2. Problem Statement

Many portfolio projects demonstrate basic database operations but fail to showcase the engineering challenges found in financial applications.

Financial systems require stronger guarantees around:

- Duplicate transactions
- Concurrent balance updates
- Failed payments
- Transaction history
- Authorization
- Data consistency
- Auditing
- Precision when handling money

PayFlow will simulate these real-world challenges within a manageable portfolio application.

---

# 3. Product Goals

The primary goal is to develop a portfolio-quality full-stack fintech application using Java Spring Boot.

The system should demonstrate proficiency in:

**Backend Development**
- Java 21
- Spring Boot
- Spring MVC
- Spring Security
- Spring Data JPA
- Hibernate
- Bean Validation
- REST API development

**Database Engineering**
- PostgreSQL
- Relational database modelling
- Database transactions
- Constraints
- Indexing
- Optimistic or pessimistic locking
- Schema migrations

**Security**
- Authentication
- JWT-based authorization
- Role-based access control
- Password hashing
- Protected APIs

**Financial Engineering Concepts**
- Wallet balances
- Ledger-style transactions
- Atomic transfers
- Idempotency
- Transaction states
- Monetary precision

**Engineering Practices**
- Unit testing
- Integration testing
- Docker
- CI/CD
- API documentation
- Logging
- Error handling

---

# 4. Non-Goals

The first version of PayFlow will not attempt to become a real payment processor.

The following are outside the MVP scope:

- Real bank integrations
- Real eSewa/Khalti/payment-gateway integrations
- Real card processing
- KYC verification using government systems
- Cryptocurrency
- Foreign-exchange payments
- Loan processing
- Production banking infrastructure
- Real-money deposits or withdrawals
- PCI-DSS-compliant card handling
- Server-side rendering, React Server Components, and frontend server functions
- Search-engine optimization requiring server-rendered application pages

These may be represented through simulated workflows where appropriate.

---

# 5. Target Users

## 5.1 Customer

A regular user who wants to:

- Register for PayFlow
- Access their wallet
- View their available balance
- Transfer money
- Pay merchants
- Review transaction history

---

## 5.2 Merchant

A merchant account that can:

- Receive customer payments
- Create payment requests
- View incoming transactions
- Review payment history

---

## 5.3 Administrator

An administrative user responsible for:

- Viewing registered users
- Reviewing transactions
- Viewing failed or suspicious transactions
- Viewing platform activity
- Managing account status

Administrators must not directly modify wallet balances without an auditable transaction.

---

# 6. User Roles

| Role | Description |
|---|---|
| USER | Standard wallet customer |
| MERCHANT | Account capable of receiving merchant payments |
| ADMIN | Administrative access |

Authorization should be enforced both at the API level and within business logic.

---

# 7. Core User Stories

## Authentication

As a new user, I want to create an account so that I can use PayFlow.

As a registered user, I want to securely log in so that I can access my wallet.

As a logged-in user, I want to access only resources belonging to me.

---

## Wallet

As a user, I want to view my wallet balance.

As a user, I want to add simulated funds to my wallet for testing purposes.

As a user, I want my balance to remain correct even when multiple transactions occur concurrently.

---

## Transfers

As a user, I want to transfer money to another registered user.

As a user, I want to know whether my transfer succeeded or failed.

As a user, I should not be able to transfer more than my available balance.

As a user, I should not accidentally create duplicate transfers if a request is retried.

---

## Merchant Payments

As a merchant, I want to create payment requests.

As a customer, I want to pay a merchant using my PayFlow wallet.

As a merchant, I want to see completed payments.

---

## Transaction History

As a user, I want to see my previous transactions.

As a user, I want to filter transactions by type, status, and date.

As a user, I want each transaction to contain a unique reference number.

---

## Administration

As an administrator, I want to review platform transactions.

As an administrator, I want to identify failed transactions.

As an administrator, I want to suspend accounts when necessary.

---

# 8. Functional Requirements

## FR-01 — User Registration

The system shall allow a user to register using:

- Full name
- Email
- Phone number
- Password

Email and phone number must be unique.

Passwords must never be stored as plain text.

---

## FR-02 — Authentication

Users shall authenticate using email and password.

Successful authentication shall return:

- Access token
- Token expiration information
- User details
- Assigned role

JWT shall be used for authenticated API requests.

For the SPA MVP:

- Send access tokens using `Authorization: Bearer <token>` to the PayFlow API.
- Keep the access token in browser memory only. On a full reload, a new tab, or access-token expiry, attempt session restoration using the refresh-token cookie before requiring login (FR-04).
- Use the login response's `accessToken`, `tokenType`, `expiresIn`, `expiresAt`, and `user`. Use `GET /api/v1/auth/me` to obtain the current profile and role when revalidating an active session.
- Logout revokes the current login session on the backend and clears its cookie. The frontend clears the access token, user state, and private query/route caches and notifies other tabs. Existing access JWTs for that session are rejected on subsequent authentication checks.
- A protected API response of `401` may trigger one coordinated refresh attempt, unless the session is already known to be invalid. If refresh returns `401`, clear private state and redirect to login. A `403` displays an access-denied or CSRF-error state without a refresh loop. Network failures display a recoverable error rather than being treated as invalid credentials.
- After login, return to a validated internal route that the user attempted to open. Never use an arbitrary external redirect URL.

Login and refresh return the same access-token/user response shape. The raw refresh token is set only through `Set-Cookie`, never included in JSON or made readable to JavaScript.

---

## FR-03 — Authorization

Protected APIs shall require authentication.

Role-based access shall restrict operations according to:

- USER
- MERCHANT
- ADMIN

Users shall not access another user's private wallet or transaction information.

---

## FR-04 — Refresh Tokens and Login Sessions

Refresh sessions are part of the MVP. This is first-party PayFlow authentication, not a new OAuth authorization server. Rotation and replay handling follow the principles in [RFC 9700, refresh-token protection](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).

### Token and Session Lifecycle

- Successful login creates a database-backed session and a cryptographically random opaque refresh token with at least 256 bits of entropy. Store only its cryptographic hash; the refresh token is not a JWT and cannot authenticate business API requests.
- Keep the access JWT lifetime configurable, defaulting to 15 minutes. Each JWT contains a `sid` identifying its login session. Its expiry must not exceed the session's current expiry.
- Default session limits are a 7-day absolute lifetime from login and a 24-hour refresh inactivity timeout, both configurable. These are PayFlow defaults, not standards. Successful refresh resets the inactivity deadline, capped by the original absolute deadline; it never extends the absolute lifetime.
- Every protected request validates the JWT and checks that its session exists, belongs to the JWT subject, is unexpired/unrevoked, and belongs to an active account. Continue using the current database role. Fail closed if session validity cannot be established; do not cache authorization in a way that delays revocation.
- Access tokens without a valid `sid`, including tokens issued before this change, require login again. Ordinary API calls do not extend session deadlines.

### Rotation and Revocation

- Refresh uses the cookie without requiring or sending an access JWT. Validate the token hash, current account status, and session deadlines; atomically consume the token and create its replacement in one database transaction. Serialize changes to the same session so concurrent requests cannot create multiple valid successors.
- Retain consumed-token hashes and their session relationship until the session's absolute expiry, so reuse can be detected. Presenting a consumed token revokes that entire login session/token family, including the currently active refresh token, and returns `401`. The revocation must commit even though the request returns an authentication error.
- The MVP uses strict single-use rotation without a replay grace period. Duplicate use, including a client retry after a lost response, can force login again. A failed database transaction must leave the original token usable; a committed rotation with a lost response cannot be assumed to have rolled back.
- Logout revokes the session identified by a recognized refresh cookie, including a retained consumed token, then clears the cookie. Logout is idempotent; absent, unknown, or already-revoked cookies still produce a successful cookie-clearing response after CSRF checks.
- Suspension revokes all of the account's sessions when that feature is implemented; subsequent reactivation must not revive them. Password reset/change must do the same when introduced. Ordinary logout affects only the current session; session-list and logout-all endpoints are outside this change.
- Immediate revocation means authentication checks after the revocation transaction commits reject access JWTs for that session. It does not undo already-authorized, in-flight financial operations.

### Browser Session Behavior

- Restore authentication on app startup before protected route loaders run. A successful refresh restores the current user and an in-memory access token; a missing/expired/revoked session requires login. Preserve a validated internal return URL.
- Coordinate refresh, login, and logout across same-origin tabs so only one session mutation is in flight. Ignore late refresh responses after logout or an account switch, and clear old-user caches before displaying the new account.
- Disable automatic transport retries for refresh. Treat network loss as an uncertain outcome, with explicit recovery or login; never repeatedly replay a potentially consumed token.
- After a successful refresh, a failed read may retry once. A financial mutation may retry only when authentication rejection is known to precede execution and the original payload and idempotency key are preserved. Network-ambiguous financial outcomes follow section 14; never automatically replay a mutation after interactive login.
- If logout cannot reach the server, clear local private state but report that server-side logout is unconfirmed and allow retry. Do not silently restore that session while logout remains pending.

---

# 9. Wallet Requirements

Each user shall have exactly one primary wallet.

A wallet shall contain:

| Field | Description |
|---|---|
| walletId | Unique wallet identifier |
| userId | Wallet owner |
| balance | Current available balance |
| currency | NPR |
| status | ACTIVE / FROZEN |
| createdAt | Creation timestamp |
| updatedAt | Last modification |

For the MVP, PayFlow will support only:

**NPR — Nepalese Rupee**

Financial values must use Java `BigDecimal`.

`float` and `double` must not be used for money.

Example:

```java
BigDecimal amount;
```

---

# 10. Simulated Wallet Funding

For portfolio demonstration purposes, authenticated users may add simulated funds.

Example:

```text
POST /api/v1/wallet/deposit
```

Request:

```json
{
  "amount": 5000
}
```

This operation must create a corresponding transaction record.

Direct database modification of wallet balances is prohibited.

---

# 11. Peer-to-Peer Transfer

Users shall be able to transfer money to another registered user.

Example:

```text
POST /api/v1/transfers
```

Request:

```json
{
  "receiverWalletId": "wallet-id",
  "amount": 1500,
  "description": "Dinner payment"
}
```

The system shall:

1. Authenticate the sender.
2. Validate the amount.
3. Confirm the receiver exists.
4. Prevent transfers to the same wallet.
5. Verify sufficient balance.
6. Debit the sender.
7. Credit the receiver.
8. Create transaction records.
9. Commit all operations atomically.
10. Return the resulting transaction.

Either the entire operation succeeds or the entire operation fails.

Partial transfers must never occur.

---

# 12. Transaction Atomicity

Money-transfer operations must execute inside a database transaction.

Spring's:

```java
@Transactional
```

shall be used where appropriate.

Example failure scenario:

```text
Sender balance deducted
        ↓
Database error occurs
        ↓
Receiver balance cannot be updated
```

Expected result:

```text
Entire transaction rolled back.
```

The sender must not lose funds.

---

# 13. Insufficient Balance Handling

If:

```text
wallet.balance < requestedAmount
```

the transfer shall fail.

Expected API response:

```json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Insufficient wallet balance."
}
```

No balance or transaction state should be partially modified.

---

# 14. Idempotency

Payment and transfer APIs shall support idempotency.

Example header:

```text
Idempotency-Key: 6e2ba334-1234-4567
```

If the same request is sent repeatedly using the same key:

```text
Request 1 → NPR 1000 transferred

Network timeout

Request 2 → Same request retried

Request 3 → Same request retried
```

Only one transfer shall occur.

Subsequent requests shall return the previously generated result.

This protects against accidental duplicate payments.

The SPA shall generate one key per intended deposit, transfer, or payment and reuse that key and payload for retries. Disable duplicate submissions while a request is pending. A timeout represents an unknown outcome: do not report failure or issue a new key until the original operation has been reconciled. Financial mutations must never run from route loaders or navigation prefetching.

---

# 15. Concurrency Handling

PayFlow must prevent race conditions when multiple transactions attempt to spend the same wallet balance simultaneously.

Example:

```text
Wallet balance: NPR 1,000

Transfer A: NPR 800
Transfer B: NPR 700

Both requests arrive simultaneously.
```

The system must never allow the wallet balance to become:

```text
-500
```

The implementation may use:

- Optimistic locking
- Pessimistic locking
- Database row locking

The selected strategy must be documented in the project's README.

---

# 16. Transaction Model

Every financial operation shall generate a transaction record.

Transaction types:

```text
DEPOSIT
TRANSFER
MERCHANT_PAYMENT
REFUND
```

Transaction statuses:

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

Example transaction:

```json
{
  "transactionId": "txn_f76da",
  "reference": "PF-2026-00001842",
  "type": "TRANSFER",
  "amount": 1500,
  "currency": "NPR",
  "status": "SUCCESS",
  "senderWalletId": "wallet_123",
  "receiverWalletId": "wallet_456",
  "description": "Dinner payment",
  "createdAt": "2026-09-25T14:30:00"
}
```

---

# 17. Transaction Reference

Every transaction must receive a human-readable unique reference.

Example:

```text
PF-2026-00001234
```

The reference may be displayed on receipts and transaction-detail pages.

---

# 18. Transaction History

Users shall be able to retrieve transaction history.

Example:

```text
GET /api/v1/transactions
```

Supported filters should include:

```text
status
type
fromDate
toDate
page
size
```

Example:

```text
GET /api/v1/transactions?status=SUCCESS&type=TRANSFER&page=0&size=20
```

Pagination is required.

---

# 19. Merchant Accounts

Merchant users shall have merchant profiles.

Merchant information may contain:

```text
Merchant ID
Business name
Contact email
Contact number
Wallet ID
Status
Created date
```

Merchant statuses:

```text
ACTIVE
SUSPENDED
```

---

# 20. Merchant Payment Requests

Merchants may create payment requests.

Example:

```text
POST /api/v1/merchant/payment-requests
```

Request:

```json
{
  "amount": 2500,
  "description": "Order #1028"
}
```

Response:

```json
{
  "paymentRequestId": "payreq_123",
  "amount": 2500,
  "currency": "NPR",
  "status": "PENDING"
}
```

Customers shall be able to complete the payment using their wallet.

---

# 21. Payment Status

Payment requests shall support:

```text
PENDING
PAID
EXPIRED
CANCELLED
```

A payment request that has already been paid must not be processed again.

---

# 22. Refunds

As an enhancement after the initial MVP, supported merchant payments may be refunded.

A refund shall:

- Reference the original payment
- Create a separate refund transaction
- Debit the merchant
- Credit the customer
- Never delete or modify the original transaction

Financial history must remain immutable.

---

# 23. Transaction Receipt

Successful transfers and merchant payments should produce a receipt page containing:

```text
Reference number
Transaction type
Sender
Receiver
Amount
Currency
Date
Status
Description
```

Example:

```text
PAYFLOW

Payment Successful

Reference: PF-2026-00001842
Amount: NPR 1,500.00
From: Biraj
To: Demo Merchant
Status: SUCCESS
Date: Sep 25, 2026
```

---

# 24. Admin Dashboard

Administrators should be able to view:

```text
Total users
Active users
Merchants
Total transactions
Successful transactions
Failed transactions
Transaction volume
Recent transactions
```

The dashboard exists primarily to demonstrate backend aggregation and administrative APIs.

---

# 25. Audit Logging

Important actions shall be auditable.

Examples include:

```text
User login
Account suspension
Wallet freeze
Money transfer
Merchant payment
Refund
Administrative action
```

An audit record may contain:

```text
auditId
actorId
action
resourceType
resourceId
timestamp
metadata
```

Audit records should not be editable by regular users.

---

# 26. Database Design

Core entities:

```text
User
Role
Wallet
Transaction
Transfer
Merchant
PaymentRequest
IdempotencyKey
AuditLog
AuthSession
RefreshToken
```

Suggested relationships:

```text
User
 │
 ├── 1:1 ── Wallet
 │
 ├── N:1 ── Role
 │
 └── 1:N ── AuthSession ── 1:N ── RefreshToken

Wallet
 │
 ├── 1:N ── Sent Transactions
 └── 1:N ── Received Transactions

Merchant
 │
 └── 1:1 ── Wallet

Merchant
 │
 └── 1:N ── PaymentRequest
```

---

# 27. Proposed Database Tables

## users

```text
id
full_name
email
phone
password_hash
role
status
created_at
updated_at
```

---

## wallets

```text
id
user_id
balance
currency
status
version
created_at
updated_at
```

The `version` column may be used for optimistic locking.

---

## transactions

```text
id
reference
type
status
sender_wallet_id
receiver_wallet_id
amount
currency
description
created_at
updated_at
```

---

## merchants

```text
id
user_id
business_name
status
created_at
updated_at
```

---

## payment_requests

```text
id
merchant_id
amount
currency
description
status
expires_at
created_at
updated_at
```

---

## idempotency_keys

```text
id
idempotency_key
user_id
request_hash
transaction_id
created_at
expires_at
```

---

## audit_logs

```text
id
actor_id
action
resource_type
resource_id
metadata
created_at
```

---

## auth_sessions

```text
id                         # JWT sid and refresh-token family identifier
user_id
created_at
absolute_expires_at
idle_expires_at
last_refreshed_at
revoked_at
revocation_reason
```

## refresh_tokens

```text
id
session_id
token_hash                 # unique; never the raw token
created_at
expires_at
consumed_at
replaced_by_token_id
```

Add these tables through a new Flyway migration, with foreign keys, unique token hashes, and indexes for user sessions, token lookup, and expiry cleanup. Enforce at most one unconsumed token per session; the session itself determines whether that token is still authorized. Session locking, rotation, and logout must share the same transaction discipline. Cleanup must retain the token history needed for reuse detection throughout the absolute session lifetime.

The authentication change requires these new tables; existing financial tables remain unchanged.

---

# 28. API Design

Base API:

```text
/api/v1
```

Authentication:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

| Endpoint | Request authentication | Successful result |
|---|---|---|
| `POST /api/v1/auth/register` | Registration JSON and authentication-flow CSRF checks | Existing registration response; does not start a session |
| `POST /api/v1/auth/login` | Email/password JSON and CSRF checks | `200`: existing access-token/user envelope plus refresh cookie; starts a session |
| `POST /api/v1/auth/refresh` | Refresh cookie and CSRF checks; no access JWT required | `200`: new access-token/user envelope plus rotated refresh cookie |
| `POST /api/v1/auth/logout` | Refresh cookie when present and CSRF checks; no access JWT required | `200`: standard success envelope with `data: null`; revokes current session and clears cookie |
| `GET /api/v1/auth/me` | Access JWT and active session | Existing current-profile response |

Refresh and logout have no request body. Invalid, expired, revoked, or reused refresh credentials return a generic JSON `401 UNAUTHORIZED`; clear the refresh cookie on this definitive failure. CSRF rejection returns `403 FORBIDDEN` without rotating or revoking a session. Unexpected server failures return the standard error envelope, not an authentication failure. Login/refresh responses and all session responses use `Cache-Control: no-store`. OpenAPI shall document both new endpoints, cookie behavior, required headers, and errors.

Only refresh and logout are new endpoints. Section 36 specifies a required custom-header CSRF defense, so no separate CSRF-bootstrap endpoint is needed.

Wallet:

```text
GET  /wallet
POST /wallet/deposit
```

Transfers:

```text
POST /transfers
GET  /transfers/{id}
```

Transactions:

```text
GET /transactions
GET /transactions/{id}
```

Merchant:

```text
POST /merchants
GET  /merchants/{id}
POST /merchants/payment-requests
GET  /merchants/payments
```

Payments:

```text
POST /payments/{paymentRequestId}/pay
GET  /payments/{paymentRequestId}
```

Admin:

```text
GET   /admin/users
GET   /admin/transactions
PATCH /admin/users/{id}/status
GET   /admin/dashboard
```

---

# 29. Standard API Response

Successful response example:

```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123"
  },
  "timestamp": "2026-09-25T15:00:00Z"
}
```

Error response:

```json
{
  "success": false,
  "code": "INSUFFICIENT_BALANCE",
  "message": "Insufficient wallet balance.",
  "timestamp": "2026-09-25T15:00:00Z"
}
```

---

# 30. Exception Handling

A centralized exception handler should be implemented using:

```java
@RestControllerAdvice
```

Examples of application-specific exceptions:

```text
UserNotFoundException
WalletNotFoundException
InsufficientBalanceException
InvalidTransferException
DuplicateTransactionException
UnauthorizedOperationException
PaymentAlreadyProcessedException
```

Sensitive implementation details and stack traces must not be returned to clients.

---

# 31. Backend Architecture

The initial application should use a **modular monolith**.

Suggested package structure:

```text
com.payflow
│
├── auth
│   ├── controller
│   ├── dto
│   ├── service
│   └── security
│
├── user
│   ├── controller
│   ├── entity
│   ├── repository
│   └── service
│
├── wallet
│   ├── controller
│   ├── dto
│   ├── entity
│   ├── repository
│   └── service
│
├── transaction
│   ├── controller
│   ├── dto
│   ├── entity
│   ├── repository
│   └── service
│
├── payment
├── merchant
├── audit
├── common
│   ├── exception
│   ├── response
│   └── util
│
└── config
```

Feature-oriented modules are preferred over placing the entire application into global `controller`, `service`, and `repository` packages.

## 31.1 Browser and API Responsibilities

```text
Browser: React SPA + TanStack Router + TanStack Query
       │ HTTPS /api/v1 requests with bearer token
       ▼
Reverse proxy / hosting layer
       ├── /api/* → Spring Boot → PostgreSQL
       └── App routes and assets → frontend/dist
```

The frontend is a separately built static application. It has no application server, server actions, or API route handlers. Route loaders execute in the browser and use the REST API. TanStack Start is not part of this architecture.

Spring Boot remains the sole authority for identity, roles, ownership, validation, balances, idempotency, and transaction outcomes. Client route guards improve navigation but cannot grant access to data. Business API contracts remain unchanged. Refresh sessions add the authentication endpoints and tables in sections 27–28; these are an authentication enhancement alongside the SPA transition.

Business APIs continue to use bearer headers. Authentication flows use a refresh cookie backed by PostgreSQL session records. Java HTTP sessions, Redis, and a separate authentication service are not required; `SessionCreationPolicy.STATELESS` can remain for servlet sessions, but authentication now includes database-backed session state.

## 31.2 API Connectivity and Conditional Backend Changes

The default deployment shall expose the SPA and `/api/v1` on the same browser origin. The frontend API base URL defaults to `/api/v1`.

- During development, serve the SPA at `http://localhost:3000` and proxy `/api` to Spring Boot at `http://localhost:8080`, preserving the complete request path. Configure this in `frontend/vite.config.ts` using Vite's `server.proxy` option. This configuration applies to development; production requires its own proxy rules. See [Vite server proxy documentation](https://vite.dev/config/server-options.html#server-proxy).
- In production, the hosting layer must forward `/api/*` to Spring Boot before applying the SPA fallback. Preserve HTTP methods, request bodies, `Authorization`, `Content-Type`, `Idempotency-Key`, `X-PayFlow-CSRF`, `Origin`/`Referer`, and `Cookie`, plus backend status codes, JSON responses, and every `Set-Cookie` header. Do not cache authentication responses or strip cookie security attributes.
- Same-origin browser requests do not require backend CORS changes. If the browser calls a separate API origin, configure exact allowed frontend origins and enable CORS in Spring Security. Process valid preflight requests before authentication; allow the required API methods and request headers (`Authorization`, `Content-Type`, `Idempotency-Key`, `X-PayFlow-CSRF`). Authentication requests must use `credentials: 'include'`, and their responses must allow credentials for the exact approved origin, never `*`. See [Spring Security CORS integration](https://docs.spring.io/spring-security/reference/servlet/integrations/cors.html).
- Keep API authentication failures as JSON `401`/`403` responses. Spring Boot must not redirect API callers to an HTML login page or serve the SPA for failed API requests.

Extend the authentication module with session/token entities, repositories, a refresh-session service, and a shared access-JWT issuer used by login and refresh. Update the security filter chain and current JWT authentication converter to enforce session validity as well as current account status/role. Add configurable session lifetimes, cookie settings, and trusted browser origins. Existing wallet, deposit, transfer, transaction, and financial repository logic remains unchanged. New merchant and admin APIs remain feature work in their existing phases.

---

# 32. Technology Stack

## Frontend

```text
React SPA
TypeScript
TanStack Router
Vite+ (Vite, Rolldown, Vitest, Oxlint, Oxfmt, and task tooling)
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
```

Vite+ is the frontend toolchain; React provides rendering, TanStack Router provides browser routing, and TanStack Query manages remote API state. Keep configuration in `frontend/vite.config.ts` using `defineConfig` from `vite-plus`. Use the committed pnpm lockfile and compatible, pinned runtime/toolchain versions. See [Vite+ getting started](https://viteplus.dev/guide/).

Frontend commands run from `frontend/`:

| Command | Purpose |
|---|---|
| `vp install` | Install frontend dependencies |
| `vp run dev` | Run the project's development script on port 3000 |
| `vp run generate-routes` | Generate the typed route tree before standalone checks |
| `vp check` | Run formatting, lint, and TypeScript checks |
| `vp test run` | Run frontend tests once |
| `vp build` | Produce static assets in `dist/` |
| `vp preview` | Preview the production build locally |

Built-in commands such as `vp check` differ from package scripts invoked by `vp run check`; the scaffold's `check` script currently only checks formatting. Without the global CLI, the local CLI can be invoked through `pnpm exec vp`.

---

## Backend

```text
Java 21
Spring Boot
Spring Web
Spring Security
Spring Data JPA
Hibernate
Spring Validation
JWT
Lombok
MapStruct — optional
```

---

## Database

```text
PostgreSQL
Flyway
```

Flyway should manage database schema migrations.

---

## Testing

```text
JUnit 5
Mockito
Spring Boot Test
Testcontainers
Vitest through Vite+
React Testing Library
Playwright (browser end-to-end tests)
```

Testcontainers may run real PostgreSQL containers during integration testing.

---

## API Documentation

```text
Springdoc OpenAPI
Swagger UI
```

Example:

```text
/swagger-ui.html
```

---

## DevOps

```text
Docker
Docker Compose
GitHub Actions
AWS
```

---

# 33. Docker Environment

The development environment should be runnable using:

```bash
docker compose up
```

Suggested containers:

```text
payflow-backend
postgres
```

Later:

```text
payflow-frontend (static web server and /api reverse proxy)
redis
notification-service
```

may also be containerized.

When containerized, the frontend image shall build with Vite+ and copy `frontend/dist` into a static web server image. Node.js and Vite+ are build-time tools, not production serving processes. The web server shall implement the API proxy and SPA fallback described in section 35.

During development, PostgreSQL/backend may run through Compose while the frontend runs locally with `vp run dev`. Frontend containerization remains a later enhancement; the MVP must document both local development and static-build serving.

---

# 34. CI/CD

GitHub Actions shall run when code is pushed or a pull request is created.

Backend pipeline:

```text
Checkout
   ↓
Install Java
   ↓
Build
   ↓
Run unit tests
   ↓
Run integration tests
   ↓
Package application
   ↓
Build Docker image
```

Frontend pipeline:

```text
Checkout
   ↓
Set up pinned Node.js, pnpm, and Vite+ versions
   ↓
Install dependencies using the frozen pnpm lockfile
   ↓
Generate route tree
   ↓
vp check
   ↓
vp test run
   ↓
vp build
   ↓
Run Playwright against the built SPA, API, and test database
   ↓
Publish dist artifact / build frontend static-server image
```

The frontend job shall use `frontend/` as its working directory. A successful bundle build alone is not a TypeScript check. CI must generate routes before checks, run the full Vite+ check command, and verify the built application's deep links and API routing. Toolchain setup must follow the [Vite+ CI guide](https://viteplus.dev/guide/ci).

Deployment automation may be added later.

---

# 35. AWS Deployment

A future production-like environment may use:

```text
Frontend
React SPA → Vite+ build → static hosting (Vercel or Amazon S3 + CloudFront)

Backend
Spring Boot → AWS

Database
PostgreSQL → Amazon RDS

Docker Image
Amazon ECR
```

Depending on complexity, the Spring Boot service could run using:

```text
AWS EC2
or
AWS ECS
```

AWS deployment should be treated as a later milestone rather than blocking MVP development.

## Static Hosting Requirements

- Deploy `frontend/dist`; no frontend Node.js application server is required. `vp preview` is for local inspection and must not be the production server. See [Vite static deployment](https://vite.dev/guide/static-deploy.html).
- Serve `index.html` for browser navigation to app paths such as `/transactions/<id>` so direct links and reloads load TanStack Router. Unknown app paths must show the router's not-found page.
- Route `/api/*` to Spring Boot before any HTML fallback. Missing static assets must return an asset error, and API errors must remain API responses; neither may be rewritten to `index.html`.
- Serve the SPA and API over HTTPS. Cache fingerprinted assets for long periods and revalidate `index.html` so releases do not strand browsers on stale asset references. Do not cache private API responses in shared caches.
- If hosting cannot provide the same-origin API proxy, use an explicit API origin and the CORS configuration from section 31.2.

## Frontend Environment Configuration

Use `import.meta.env.VITE_API_BASE_URL` for an optional public API base URL; default to `/api/v1`. This value is embedded at build time. Changing an environment variable on a running static server does not change an already-built bundle; rebuild when changing an embedded API URL. Same-origin deployments can reuse the relative URL across environments.

All `VITE_*` variables are public browser configuration. JWT signing keys, database credentials, and other secrets must stay in the backend environment and must never enter frontend bundles. Maintain separate backend and frontend environment examples. See [Vite environment variables and modes](https://vite.dev/guide/env-and-mode.html).

---

# 36. Security Requirements

Passwords must be hashed using BCrypt.

Authentication endpoints must be protected against information leakage.

JWT secrets must be supplied through environment variables.

Sensitive configuration must never be committed to Git.

The system shall validate all client input.

Protected endpoints shall verify user ownership.

Financial operations shall require authenticated users.

Administrative APIs shall require the `ADMIN` role.

Frontend route guards and role-based menus are not authorization boundaries. All API checks apply even when requests bypass the SPA.

Do not store access or refresh tokens in `localStorage`, `sessionStorage`, URLs, or logs. Private API data must not survive logout in frontend caches. Hash refresh tokens before persistence and redact `Cookie`, `Set-Cookie`, and authorization headers from logs.

## Refresh Cookie Policy

Use a host-only `payflow_refresh` cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/api/v1/auth`. Omit `Domain`; set `Max-Age` no longer than the remaining idle/absolute deadline and renew it on rotation. Clear it with the same name, path, and domain scope. Scope authentication to this cookie only at refresh/logout; possession of the cookie alone must never authorize wallet or transaction endpoints. `HttpOnly` prevents direct JavaScript reads but does not prevent malicious scripts from issuing requests. See [OWASP session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

The default same-origin topology supports this cookie policy. Different origins on the same site still need credentialed CORS. A genuinely cross-site frontend/API deployment would require `SameSite=None; Secure` and can be disrupted by third-party-cookie blocking; prefer a same-origin proxy instead. Use local HTTPS or an explicitly local-only insecure-cookie override for HTTP development; production must require secure cookies.

## CSRF Protection for Authentication Flows

Require `X-PayFlow-CSRF: 1` on registration, login, refresh, and logout. Validate `Origin` against exact configured frontend origins; fall back to the parsed `Referer` origin when absent, and reject missing/untrusted origins. Reject simple form submissions; registration/login accept JSON only. The header is a mandatory non-simple-request marker, not a secret. Strict CORS preflight rules prevent an untrusted website from sending it. `SameSite` is additional protection. This uses [OWASP's custom-header CSRF defense](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi).

Implement these checks in the security layer before authentication-flow side effects. Retaining the current blanket CSRF disablement without this replacement is unacceptable. Bearer-only business APIs may remain exempt while they reject cookie authentication. Configure Swagger, CLI examples, and tests to send the documented custom header and trusted origin. Cross-origin permission must never be granted through wildcard/subdomain-pattern origins.

---

# 37. Validation Requirements

Examples:

Transfer amount:

```text
amount > 0
```

Email:

```text
Valid email format
```

Password:

```text
Minimum 8 characters
```

Phone:

```text
Valid supported format
```

Currency:

```text
NPR only during MVP
```

Client-side validation should improve UX, but all rules must also be enforced by the backend.

---

# 38. Monetary Precision

Money must never use floating-point primitives.

Incorrect:

```java
double balance = 1000.50;
```

Correct:

```java
BigDecimal balance = new BigDecimal("1000.50");
```

Database fields should use an appropriate decimal type such as:

```sql
DECIMAL(19, 2)
```

---

# 39. Logging

Backend logs should include useful operational information while avoiding sensitive data.

Good log:

```text
Transfer completed: reference=PF-2026-00001842
```

Bad log:

```text
User password: ...
JWT token: ...
```

Sensitive credentials must never appear in logs.

---

# 40. Testing Requirements

Critical business operations should receive stronger test coverage than simple CRUD endpoints.

High-priority tests include:

```text
Successful wallet transfer

Transfer with insufficient balance

Transfer to nonexistent wallet

Transfer to same wallet

Concurrent transfers

Duplicate request using same idempotency key

Unauthorized wallet access

Successful merchant payment

Repeated merchant payment

Database rollback after transfer failure
```

Integration tests should verify database behavior, not only mocked service behavior.

SPA and browser integration tests shall cover:

- Registration, login, authenticated wallet access, deposits, transfers, history, and transaction details against the real backend in the end-to-end suite.
- Protected-route redirects, internal return URLs, role restrictions, access-token renewal, session expiry, logout, automatic restoration after reload, and clearing private data when switching users.
- Loading, empty, validation, `401`, `403`, and recoverable network-error states.
- A timed-out financial request retried with the same idempotency key, producing exactly one financial operation; navigation/prefetch must never submit a financial mutation.
- Wallet and history refresh after successful mutations, plus validated history filters and pagination through browser back/forward navigation.
- Direct navigation and reload of a nested route in the production static-server configuration; `/api/*` and missing assets must not return SPA HTML.
- Allowed and rejected credentialed CORS preflights if separate-origin API access is enabled, including idempotency and CSRF headers.

Authentication integration tests shall additionally verify:

- Login sets the correct cookie attributes and creates hashed token/session records; refresh tokens never appear in JSON responses, logs, or database plaintext.
- Refresh works without an access JWT, rotates exactly once, returns the current role/profile, and respects both absolute and idle deadlines. Business APIs reject refresh cookies without bearer authentication.
- Reuse commits session-family revocation and causes both current refresh tokens and previously issued access JWTs to be rejected. Logout has the same immediate access-token effect and does not revoke another independent session.
- Expired/revoked/unknown sessions, mismatched JWT subject/session, missing `sid`, suspended accounts, and database failures cannot authorize protected requests.
- Concurrent rotation creates at most one successor; consumed-token replay follows the strict policy. Refresh-versus-logout races cannot revive a revoked session. Rolled-back rotation preserves the original token; lost-response recovery cannot loop indefinitely.
- Missing custom CSRF headers, untrusted/missing origins, and simple form requests are rejected before session mutations, even with a valid cookie. Successful logout remains idempotent after CSRF checks.
- Coordinated tab refresh, session restoration, logout notifications, account switching, and late responses do not restore stale private state. Unconfirmed logout is shown accurately.

---

# 41. Frontend Pages

The frontend shall use TanStack Router file-based routing with typed navigation, nested layouts, and route code splitting. Keep route files under `frontend/src/routes`, with `__root.tsx` as the root layout and `routeTree.gen.ts` generated by the router tooling. Configure `@tanstack/router-plugin/vite` before the React plugin with `target: 'react'` and `autoCodeSplitting: true`. Do not hand-edit the generated tree. See [TanStack Router installation with Vite](https://tanstack.com/router/latest/docs/installation/with-vite).

| Page | Browser path | Access | Phase |
|---|---|---|---|
| Landing page | `/` | Public | MVP |
| Register | `/register` | Public | MVP |
| Login | `/login` | Public | MVP |
| Dashboard | `/dashboard` | Authenticated | MVP |
| Wallet / Add Demo Funds | `/wallet` | Authenticated | MVP |
| Send Money | `/send` | Authenticated | MVP |
| Transaction History | `/transactions` | Authenticated | MVP |
| Transaction Details / Receipt | `/transactions/$transactionId` | Authenticated owner/participant | MVP |
| Profile | `/profile` | Authenticated; view current profile | MVP |
| Merchant Payment | `/payments/$paymentRequestId` | Authenticated eligible payer | Phase 2 |
| Merchant Dashboard | `/merchant` | MERCHANT | Phase 2 |
| Admin Dashboard | `/admin` | ADMIN | Phase 2 |

`$transactionId` and `$paymentRequestId` denote TanStack Router path parameters. Browser paths are distinct from `/api/v1` endpoints. Merchant and admin routes follow the backend feature phases and are not required to complete the SPA migration.

## Route Access and State

Use a pathless authenticated layout with `beforeLoad` and router context to check session state before loading protected child routes. Await one coordinated startup restoration operation rather than refreshing independently in each loader; show a pending state until it completes. Merchant and admin layouts add role checks. Re-evaluate route access when authentication changes and implement pending, error, access-denied, and not-found views. Backend authorization remains mandatory. See [TanStack Router authenticated routes](https://tanstack.com/router/latest/docs/guide/authenticated-routes).

Keep transaction filters and pagination in validated URL search parameters: `status`, `type`, `fromDate`, `toDate`, `page`, and `size`. Match the API's zero-based pages, supported enums, page-size limits, and timestamp semantics. Bookmarks and back/forward navigation must restore the selected view after authentication.

## API Data and Mutations

Use a shared typed API client for the `/api/v1` base URL, bearer headers, response envelopes, and consistent errors. Use TanStack Query for remote data and mutations; route loaders may prepare the same query cache through `queryClient.ensureQueryData`. Avoid separate competing caches for wallet/history data. See [TanStack Router external data loading](https://tanstack.com/router/latest/docs/guide/external-data-loading).

Scope private query keys to the signed-in user and include relevant filters and pagination. After a successful deposit, transfer, or payment, invalidate/refetch the wallet, history, and relevant dashboard queries. Render confirmed outcomes from backend responses; do not optimistically treat a balance change as a completed financial operation. Explicitly configure financial mutation retries to follow section 14 and never silently resubmit after reauthentication.

Use React Hook Form and Zod for form validation and feedback. Backend validation remains authoritative, and the browser must not recompute authoritative balances or monetary totals using floating-point arithmetic.

---

# 42. User Dashboard

The standard dashboard should display:

```text
Available balance

Wallet number

Recent transactions

Send Money button

Add Demo Funds button

Transaction statistics
```

Example:

```text
Welcome back, Biraj

Available Balance
NPR 24,500.00

[ Send Money ] [ Add Funds ]

Recent Transactions

↓ Payment received       + NPR 2,000
↑ Transfer               - NPR   500
↑ Merchant payment       - NPR 1,200
```

---

# 43. UX Requirements

Financial operations must clearly communicate their outcome.

Before sending money:

```text
Receiver
Amount
Fee
Total
```

A confirmation step should appear before completing the transaction.

After success:

```text
Payment Successful
Reference Number
Amount
Receiver
Date
```

Critical actions should not rely solely on color to communicate status.

---

# 44. Non-Functional Requirements

## Performance

Normal API requests should aim to respond within approximately:

```text
< 500 ms
```

under expected demonstration workloads.

Performance targets are goals rather than strict production SLAs.

---

## Reliability

Financial operations must prioritize correctness over performance.

Balances must never become inconsistent due to partial updates.

---

## Maintainability

Business logic should remain separate from controller logic.

Controllers should primarily:

```text
Accept requests
Validate requests
Call application/service layer
Return responses
```

Financial rules should live within domain/service logic.

---

## Scalability

The MVP does not need massive scale.

Architecture should nevertheless avoid unnecessary coupling that would prevent future extraction of services.

---

# 45. MVP Scope

The first portfolio-ready release should contain:

```text
User registration
Login
JWT authentication
Rotating refresh tokens and session restoration
Server-side logout and immediate session revocation
Authentication-flow CSRF protection
Role-based authorization
Wallet creation
Simulated deposit
Wallet balance
P2P transfer
Transaction history
Transaction details
BigDecimal money handling
Database transactions
Idempotency protection
PostgreSQL
Flyway
Swagger
Unit tests
Integration tests
Docker Compose
React SPA with TanStack Router and Vite+
Professional README
```

Everything beyond this is secondary.

---

# 46. Phase 2

After the MVP is stable:

```text
Merchant accounts
Merchant payment requests
Payment receipts
Refunds
Admin dashboard
Account freezing
Advanced transaction filtering
Audit logs
Email notifications
```

---

# 47. Phase 3 — Advanced Architecture

Potential portfolio enhancements:

```text
Redis caching

Kafka or RabbitMQ

Notification microservice

API rate limiting

Observability

Prometheus

Grafana

Distributed tracing

Kubernetes

AWS deployment
```

These features should only be introduced after a clear use case exists.

---

# 48. Microservices Evolution

The initial system should remain a modular monolith.

Later, asynchronous notifications can provide a meaningful first microservice extraction.

Example:

```text
Payment Service
      │
      │ PaymentCompletedEvent
      ▼
 Kafka / RabbitMQ
      │
      ▼
Notification Service
      │
      ├── Email
      └── In-app notification
```

This provides a realistic reason for event-driven architecture.

---

# 49. Success Metrics

The project will be considered successful when:

- An authenticated user can transfer simulated money between wallets.
- No transfer can create a negative wallet balance.
- Failed transfers preserve the original balances.
- Duplicate API requests cannot create duplicate payments.
- Transactions are fully auditable.
- Authentication and authorization protect user resources.
- Core business rules have automated tests.
- The application can be started through Docker.
- APIs are documented through Swagger.
- The project has a professional README.
- A reviewer can understand the architecture without reading the entire codebase.

---

# 50. Portfolio Presentation

The GitHub README should highlight the engineering challenges rather than merely listing technologies.

Recommended sections:

```text
Project Overview
Architecture
Key Features
Tech Stack
Database Design
API Documentation
Transaction Flow
Concurrency Handling
Idempotency Strategy
Security
Testing Strategy
Docker Setup
Screenshots
Deployment
Lessons Learned
```

A useful architecture diagram should also be included.

---

# 51. Suggested GitHub Description

**PayFlow is a full-stack digital wallet and payment platform built with Java Spring Boot, a React and TypeScript SPA using TanStack Router and Vite+, and PostgreSQL, demonstrating secure authentication, transactional money transfers, idempotent payment processing, concurrency handling, testing, containerization and production-oriented backend architecture.**

---

# 52. Suggested Résumé Description

**PayFlow — Digital Wallet & Payment Platform**

Developed a full-stack fintech wallet platform using **Java Spring Boot, React, TypeScript, TanStack Router, Vite+ and PostgreSQL**, implementing secure JWT authentication, wallet-to-wallet transfers, transaction history and merchant payment workflows.

Implemented **atomic financial transactions, BigDecimal-based monetary calculations, idempotent payment requests and concurrency controls** to prevent duplicate transactions and inconsistent wallet balances.

Containerized the application using **Docker**, documented REST APIs using **OpenAPI/Swagger**, and implemented automated unit and integration tests using **JUnit, Mockito and Testcontainers**.

---

# 53. Recommended Development Priority

Development should follow this dependency order:

```text
Project Setup
      ↓
Database + Flyway
      ↓
User Model
      ↓
Authentication
      ↓
Security
      ↓
Wallet
      ↓
Simulated Deposit
      ↓
Transactions
      ↓
P2P Transfer
      ↓
@Transactional
      ↓
Concurrency Protection
      ↓
Idempotency
      ↓
Transaction History
      ↓
Testing
      ↓
Docker
      ↓
React SPA + API Integration + Browser Tests
      ↓
Merchant Payments
      ↓
AWS / Advanced Features
```

This order ensures that advanced functionality is built on top of a reliable financial core.

---

# 54. Definition of Done

PayFlow MVP is considered complete when a reviewer can:

1. Clone the repository.
2. Start PostgreSQL and the backend through Docker Compose.
3. Open Swagger documentation.
4. Register two users.
5. Add simulated funds.
6. Transfer money between the users.
7. Retry the same transfer without creating a duplicate transaction.
8. Attempt an invalid transfer and observe proper error handling.
9. View updated wallet balances.
10. View transaction history.
11. Run the automated test suite.
12. Use the React SPA with TanStack Router to perform the core workflow.
13. Open or reload a nested frontend URL and restore a valid session without entering credentials; sign in and return to the requested page when the session has expired.
14. Renew an expired access token through refresh, then log out and verify that private UI/caches are cleared and the server rejects both the old access JWT and refresh token for that session.
15. Build and serve `frontend/dist` with working SPA fallback and API forwarding, and pass frontend checks and browser tests.
16. Reuse a consumed refresh token and verify that session-family revocation persists, then verify that expiry, CSRF checks, and concurrent refresh/logout behavior pass the authentication test suite.

At that point, PayFlow will provide a strong demonstration of Java Spring Boot backend engineering, full-stack development and fintech-oriented system design.

---

# 55. Frontend and Authentication Transition Checklist

This revision changes the target architecture and requirements; it does not claim that the application integration is already implemented.

Repository review on 2026-09-30 found an existing React SPA scaffold with Vite+, TanStack Router, Tailwind CSS, and shadcn/ui. Spring Boot currently provides access-token-only bearer authentication and the core wallet/transaction APIs. Refresh sessions, refresh/logout endpoints, and session-bound JWT validation are not yet implemented. The frontend has no API proxy configured, and Spring Security has no explicit CORS integration or authentication-flow CSRF defense.

| Area | Required implementation work |
|---|---|
| Frontend foundation | Extend the existing scaffold; add TanStack Query, React Hook Form, Zod, and frontend test dependencies/configuration. |
| Routing and authentication | Implement the MVP route table, in-memory access tokens, cookie-backed session restoration, coordinated refresh across tabs, route guards, logout, and cache cleanup. |
| API integration | Add the shared API client, development `/api` proxy, data loading, mutation handling, and idempotency-key lifecycle. |
| Backend authentication | Add refresh-session/token tables through Flyway, shared JWT issuance with `sid`, refresh/logout endpoints, atomic rotation/reuse detection, immediate revocation checks, and authentication tests. Reject pre-change access JWTs lacking a valid session. |
| Backend security | Add cookie policy, authentication-flow CSRF checks, and configurable trusted origins/lifetimes. Add credentialed CORS/preflight tests if enabling separate-origin browser access. Preserve financial API contracts and business logic. |
| Build and hosting | Add static-server SPA fallback, production API proxy, public environment example, and frontend CI/browser tests; add a frontend container when containerizing the UI. |
| Documentation | Update the root README's obsolete frontend plan and access-token-only authentication description, plus the frontend README's TanStack Start/server-function examples. Document session restoration, expiry/logout/reuse behavior, cookie/CSRF settings, API examples, commands, and deployment. |

Completion is measured by section 54. The linked official documentation supports tooling and security principles; the same-origin API default, token/session lifetimes, strict rotation policy, immediate revocation, and phase boundaries are PayFlow design decisions. Vite+ and TanStack Router do not themselves require refresh tokens; this revision adopts refresh sessions to improve authentication continuity and session control.
