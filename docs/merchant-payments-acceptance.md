# Phase 2 merchant payment acceptance

The canonical API namespace is **`/api/v1/merchants`**. The SPA dashboard is
`/merchant`; customer payment links are `/payments/<paymentRequestId>`.

## Customer → merchant → shared receipt

1. Register a merchant and customer in separate browser sessions. Each starts with
   one NPR 0.00 wallet. On the merchant account, open `/merchant`, choose
   **Set up merchant profile**, enter the business name and business contacts in
   the dialog, and choose **Create merchant profile**. The backend
   assigns MERCHANT and binds the existing wallet; the browser cannot select
   roles, accounts, wallets, or balances.
2. Choose **New payment request** and create a request for **NPR 250.25**,
   description **Order #1028**, in the dialog. It is PENDING and expires in
   24 hours. Copy the link from the **Payment requests** tab.
3. On the customer's wallet, choose **Add demo funds** and add **NPR 1,000.00**
   in the dialog. Open the merchant's payment link
   in that customer's session. Verify the business name, order, fixed amount,
   NPR 0.00 fee, and NPR 250.25 total; confirm payment.
4. The customer has **NPR 749.75**, the merchant has **NPR 250.25**, the request is
   PAID, and there is **one SUCCESS / MERCHANT_PAYMENT** transaction. Both
   participants can open the same reference and transaction receipt. Refresh the
   merchant dashboard to see the balance and PAID request. Open the **Incoming
   payments** tab to see its single settlement. **View receipt** (or **Receipt**
   on the merchant request) opens a preview dialog; **Open full receipt** provides the shareable receipt route. Dashboard
   data also refreshes automatically every 10 seconds.
5. A repeated same-key payment returns that identical receipt without changing
   balances. A new key or another customer attempting that paid request receives
   `409 / PAYMENT_REQUEST_PAID` and causes no wallet update. Reusing the original
   key for another request returns `409 / IDEMPOTENCY_CONFLICT`.

## Evidence for exactly one debit and credit

The PostgreSQL integration suite uses the real security filter chain, sessions,
Flyway migrations, repositories, and row locks. Its acceptance case checks the
balances above, one merchant-payment row, the PAID request, stable receipts, and
wallet versions: the funded customer's version moves from 1 to 2 and the merchant's
version from 0 to 1. Retries do not change either balance or version.

Barrier-synchronized tests start requests concurrently:

| Competing attempts | Expected result |
| --- | --- |
| Same customer, same request, same key | Both return the same receipt; one settlement |
| Same customer, same request, different keys | One 200, one 409; one settlement |
| Two funded customers, one request | One 200, one 409; only winner is debited |
| Two requests exceeding a customer's combined balance | One succeeds; no negative balance; money conserved |
| Merchant payment and transfer spending the same wallet | Shared wallet locks allow one winner; no overdraft |
| Opposite-direction payments between two merchants | Both settle without deadlock; incoming lists exclude outgoing payments |
| Cancellation and payment for one request | Exactly one terminal outcome, PAID or CANCELLED |

The database enforces unique settlement by request and unique merchant-payment
keys by payer. Spring transaction boundaries include both balance updates,
receipt insertion, and PAID status. Tests inject failures **after wallet flush**
at receipt insertion and request settlement, then verify both balances, versions,
wallet timestamps, receipts, and request state roll back. Retrying that original
key then succeeds exactly once.

Other cases cover ownership, payer-only recovery, nonparticipant receipt privacy,
invalid amounts/keys, expiration, cancellation, self-payment, frozen wallets,
suspended merchants, insufficient funds, and recipient balance limits.

Run against an isolated PostgreSQL Testcontainer (no development data is cleared):

```bash
cd backend
./mvnw verify
```

[MerchantPaymentTests](../backend/src/test/java/com/payflow/backend/payment/MerchantPaymentTests.java)
is the source of the server integrity assertions.

## Lost response in a real browser

The [browser scenario](../frontend/e2e/merchant.spec.ts) enrolls a merchant through
the UI, creates a request, funds a customer, and commits payment at the backend
while dropping its response at the browser boundary. It proves that:

- The customer sees **Outcome unknown**.
- Reload restores the original request/key and makes no automatic payment POST.
- Explicit retry sends the identical key and payload and returns the original receipt.
- The customer's balance is NPR 749.75; the merchant's balance is NPR 250.25.
- The dashboard contains one incoming payment; both sessions open the same receipt.
- Reopening the paid request offers the receipt and no new confirmation action.

Run against the built Compose stack:

```bash
cd frontend
vp install --frozen-lockfile
pnpm exec vp check
pnpm exec vp test run
pnpm exec vp build
PAYFLOW_BASE_URL=http://localhost:3000 pnpm exec vp run test:e2e
```

Use the configured frontend port/origin if different. The backend must trust that
same origin for authentication cookies. Browser transport-failure coverage
complements the real database concurrency tests; it does not replace them.

## API contract

All endpoints return the existing PayFlow envelope. Reads require authentication.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/v1/merchants` | Enroll self with businessName, contactEmail, contactNumber; identical repeats are safe |
| `GET /api/v1/merchants/me` | Own profile or 404 before enrollment |
| `GET /api/v1/merchants/{id}` | Shareable business profile, without private account/balance data |
| `POST /api/v1/merchants/payment-requests` | MERCHANT creates immutable amount/description; optional future expiresAt |
| `GET /api/v1/merchants/payment-requests?page=0&size=20` | Owner's requests, newest first; size 1–100 |
| `POST /api/v1/merchants/payment-requests/{id}/cancel` | Owner-only cancellation; serialized with payment |
| `GET /api/v1/merchants/payments?page=0&size=20` | Only incoming merchant payments, with participant receipts |
| `GET /api/v1/payments/{paymentRequestId}` | Business, amount, status, expiration; receipt ID only for participants |
| `POST /api/v1/payments/{paymentRequestId}/pay` | USER/MERCHANT pays another wallet with required Idempotency-Key; no amount/recipient body |
| `GET /api/v1/transactions/outcome?operation=MERCHANT_PAYMENT&key=...` | Payer-scoped FOUND receipt or UNKNOWN; UNKNOWN does not mean failure |

Expired status is derived from the deadline for pending requests and rechecked
under the request lock. No background expiration job is required. Other Phase 2 features remain separate work.

## Full merchant refund

1. Complete the NPR 250.25 payment above, with customer NPR 749.75 and merchant NPR 250.25.
2. In **Incoming payments**, open the payment receipt and choose **Refund payment**. The accessible **Confirm full refund** dialog shows NPR 250.25, the original customer wallet, and payment reference. Cancel produces no request. Choose **Confirm refund** to submit.
3. The merchant has NPR 0.00 and the customer NPR 1,000.00. The original receipt remains SUCCESS with derived **Refunded** status and **View refund receipt**. The separate refund receipt identifies **Merchant payment refund**, reversed sender/recipient, and **View original payment**. Both participants can access both records; unrelated accounts cannot.
4. The merchant dashboard keeps the incoming payment and marks it **Refunded**. Customer history contains one **Refund received**; merchant history contains one **Refund sent**.
5. A repeated original key returns the same refund. Concurrent same-key attempts return the same receipt; concurrent different keys produce one success and one conflict. Wallet versions increment once for each refund debit/credit. The request remains PAID and cannot be paid again.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/v1/merchants/payments/{transactionId}/refund` | Receiving merchant only, required Idempotency-Key, no body; full original amount/customer |
| `GET /api/v1/transactions/outcome?operation=REFUND&key=...` | Initiating merchant-scoped FOUND refund receipt or UNKNOWN |

The PostgreSQL integration suite covers exact balance restoration, original-row preservation, same/different-key concurrency, authorization, invalid keys/bodies, ineligible transactions, key conflicts, insufficient funds, frozen participant wallets, suspended accounts/profiles, recipient balance limits, and injected failure after wallet flush. The injected failure rolls back balances, versions, timestamps, and receipt/key; retrying the original key succeeds once.

The browser acceptance also commits a refund and drops its response, reloads the original payment receipt without a second POST, explicitly retries the same key/body, and checks restored balances, refund history, dashboard status, both linked receipts, and customer absence of refund controls. Session storage retains the original key until recovery completes. UNKNOWN is not failure, and no refund is automatically replayed.


Validation recorded on 2026-09-30: backend formatting and `./mvnw verify` passed 181 tests, including 38 merchant payment/refund cases; frontend format/lint/type checks, 42 unit tests, and production build passed. All 7 browser tests passed on the source-rebuilt Compose stack at `http://localhost:13000`. Interactive T3 preview also verified confirmation details and both linked receipts.


## Administrative availability controls

The [admin/freezing acceptance scenario](admin-freezing-acceptance.md) exercises the real ADMIN controls that suspend participants and freeze wallets. New merchant payments/refunds re-read participant account state while holding the shared financial wallet locks. Account suspension and wallet freezing serialize against those same locks; no partial financial changes or keys survive rejection. Same-key committed payment/refund receipts remain recoverable by an active authenticated initiator after counterparties become unavailable. Suspension revokes all sessions; reactivation requires a fresh login, and does not unfreeze the wallet. The admin suite extends merchant/refund concurrency and rollback coverage without replacing these original acceptance cases.

Combined validation on 2026-09-30: backend formatter/verify passed 210 tests, frontend checks passed 44 unit tests and production build, and all 8 browser tests passed on the source-rebuilt Compose stack at `http://localhost:13000`, retaining its existing configuration and database volume.
