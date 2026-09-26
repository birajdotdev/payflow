# Product Requirements Document

## PayFlow — Digital Wallet & Payment Platform

**Document Version:** 1.0  
**Product Type:** Fintech / Digital Wallet Platform  
**Primary Objective:** Portfolio and learning project demonstrating production-oriented Java Spring Boot backend development  
**Target Platform:** Web  
**Frontend:** Next.js + TypeScript  
**Backend:** Java 21 + Spring Boot  
**Database:** PostgreSQL  

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

---

## FR-03 — Authorization

Protected APIs shall require authentication.

Role-based access shall restrict operations according to:

- USER
- MERCHANT
- ADMIN

Users shall not access another user's private wallet or transaction information.

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
```

Suggested relationships:

```text
User
 │
 ├── 1:1 ── Wallet
 │
 └── N:1 ── Role

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

# 28. API Design

Base API:

```text
/api/v1
```

Authentication:

```text
POST /auth/register
POST /auth/login
GET  /auth/me
```

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

---

# 32. Technology Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
```

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
payflow-frontend
redis
notification-service
```

may also be containerized.

---

# 34. CI/CD

GitHub Actions shall run when code is pushed or a pull request is created.

Pipeline:

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

Deployment automation may be added later.

---

# 35. AWS Deployment

A future production-like environment may use:

```text
Frontend
Next.js → Vercel

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

---

# 41. Frontend Pages

The frontend should include:

```text
Landing page

Register

Login

Dashboard

Wallet

Send Money

Transaction History

Transaction Details

Merchant Payment

Merchant Dashboard

Admin Dashboard

Profile
```

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
Next.js frontend
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

**PayFlow is a full-stack digital wallet and payment platform built with Java Spring Boot, Next.js, TypeScript and PostgreSQL, demonstrating secure authentication, transactional money transfers, idempotent payment processing, concurrency handling, testing, containerization and production-oriented backend architecture.**

---

# 52. Suggested Résumé Description

**PayFlow — Digital Wallet & Payment Platform**

Developed a full-stack fintech wallet platform using **Java Spring Boot, Next.js, TypeScript and PostgreSQL**, implementing secure JWT authentication, wallet-to-wallet transfers, transaction history and merchant payment workflows.

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
Frontend
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
12. Use the Next.js frontend to perform the core workflow.

At that point, PayFlow will provide a strong demonstration of Java Spring Boot backend engineering, full-stack development and fintech-oriented system design.