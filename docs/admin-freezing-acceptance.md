# Phase 2 admin and freezing acceptance

This focused slice supplies `/admin` with account/wallet pagination, details and
status controls. Advanced filtering, notifications and aggregation remain deferred.
The authoritative contract is PRD sections 24–25.

## Complete browser workflow

1. Register a local demo administrator as a normal USER. Run
   `scripts/provision-demo-admin.sh <registered-email>` from the repository root.
   Existing sessions are revoked; reload and sign in again. Repeating provisioning
   returns **Already ADMIN; no change**. No default password or public elevation exists.
2. Open **Administration**. Move to the next Accounts page and back; inspect an
   account's name, email, phone, role, account/wallet UUIDs, current states, balance
   and timestamps. Open **Suspend account**. Check the target, ACTIVE → SUSPENDED,
   reason field and session/financial consequences. Cancel leaves everything unchanged.
3. In a separate customer's session, add **NPR 100.00**. The automated scenario
   commits funding while dropping the response, leaving **Outcome unknown**.
4. In admin Wallets, inspect that customer's wallet and choose **Freeze wallet**.
   A blank reason fails validation. Enter **Investigating demo wallet activity**
   and confirm. The scenario also drops this committed admin response, verifies the
   confirmation still says freeze, and explicitly retries the same status/reason.
   The wallet is FROZEN with exactly **one** ACTIVE → FROZEN audit record.
5. Reload the customer: no funding POST is automatically replayed. Retry the original
   funding request; it preserves the key and returns the original committed receipt.
   The balance is **NPR 100.00**. **Wallet frozen** explains the restrictions. A new
   NPR 1.00 deposit is rejected; history and receipts remain readable.
6. Admin suspends the account with **Account review**. Customer reload returns to
   login; the existing session, refresh and bearer tokens are unusable. Login returns
   the generic credential error. Reactivate with **Account review complete**.
   Reload still requires login, and the validated previous internal route is preserved.
   Sign in anew: the wallet remains FROZEN.
7. Unfreeze with **Wallet review complete**. The wallet audit shows both transitions.
   Customer reload shows ACTIVE; a new NPR 1.00 funding succeeds, leaving **NPR 101.00**.
   Account audit history shows suspension/reactivation with actor, states, reasons and
   timestamps. Wallet and account states change independently.
8. Customer `/admin` shows **Access denied**, has no Administration navigation, and
   cannot call any administrative API. Merchant APIs also cannot call admin controls.
   The administrator's own details explain **You cannot suspend your own account**.
   The backend blocks self-suspension and opposing administrator suspensions preserve
   one active administrator. Repeated same-state requests create no redundant audits.

The [browser test](../frontend/e2e/admin.spec.ts) creates unique demo accounts and
21 pagination fixtures. It uses the operator provisioning script against the local
PostgreSQL container, not an HTTP test backdoor. It preserves existing database data.
Run after the source-built backend is ready:

```bash
cd frontend
PAYFLOW_BASE_URL=http://localhost:13000 pnpm exec vp run test:e2e
```

Use the actual configured frontend origin (default 3000), also trusted by the backend.
The other seven browser tests verify existing merchant/refund/session flows.

## PostgreSQL integrity and race evidence

[AdminTests](../backend/src/test/java/com/payflow/backend/admin/AdminTests.java)
uses the real migrations, security filter chain, sessions and PostgreSQL Testcontainer.
It covers authorization/privacy, paginated lists/history, invalid state/reason/extra
fields, public privilege inputs, suspension and all session types, fresh reactivation,
independent account/wallet transitions, no-op timestamps/versions, concurrent duplicate
changes, self-suspension, opposing admin suspension, financial rejection/recovery,
rollback and database audit integrity.

| Locked race | Expected outcome |
| --- | --- |
| Financial operation reaches receipt insertion first, after wallet flush | Deposit/transfer/payment/refund commits; later freeze commits; original key returns its receipt |
| Freeze reaches audit insertion first, after status flush | New deposit/transfer/payment/refund waits and rejects; no financial changes |
| Counterparty suspension holds its wallet first | Transfer/payment/refund waits, rereads status, rejects without money changes |
| Already authenticated deposit waits behind its own suspension | It rejects ACCOUNT_UNAVAILABLE after the lock; no receipt/key; subsequent bearer requests get 401 |
| Login/refresh competes with suspension | No live session survives suspension or reappears on reactivation |
| Two admins suspend one another | One succeeds; the other is rejected; one ACTIVE ADMIN remains |
| Same-state administrative requests compete | Both safely succeed with exactly one audit/transition |

Tests pause real transactions with a separate PostgreSQL advisory gate and inspect
lock waiters. They do not infer ordering from arbitrary sleeps. Shared wallet locks
serialize across application instances. Rejected financial attempts preserve balances,
wallet versions/timestamps, financial receipts/keys and payment-request states.
Matching committed keys bypass new-operation availability checks, while authentication
and participant ownership still apply. UNKNOWN recovery is never proof of failure.

An injected audit insertion failure runs after status/session updates are flushed.
It proves account state/timestamps, wallet balance/state/version/timestamps, all session
revocations and the audit row roll back together. Retry then creates one valid audit.
Database tests reject audit edits/deletes and invented targets. Missing/invalid actors,
target types, state transitions and reasons are constrained by the schema/trigger.

```bash
cd backend
./mvnw spring-javaformat:apply
./mvnw verify
```

Frontend confirmation retry regression tests preserve the originally selected action
and reason when an admin response is lost and details refetch the already changed state.
This prevents an ambiguous freeze result from becoming an unintended unfreeze request.

## Validation recorded on 2026-09-30

- Backend formatter and `verify`: **210 passed**, including **29 admin PostgreSQL cases**;
  executable production JAR built.
- Frontend formatter, lint/TypeScript checks: passed; **44 unit tests passed**;
  production build passed.
- Source-built Compose at `http://localhost:13000`: **8 browser tests passed**, including
  the full admin workflow and existing merchant/full-refund lost-response scenarios.
- Product-native T3 preview inspected administrative lists, owner/state/audit detail,
  and target/action/reason/consequence confirmations with cancellation.
- Running Compose ports/authentication configuration and the existing PostgreSQL volume
  were preserved. No PR was created or merged.
