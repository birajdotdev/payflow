# Transaction filtering acceptance

## Contract

Signed-in wallet history combines type, stored status, inclusive start/exclusive
end UTC dates, inclusive minimum/maximum NPR amount, and an exact counterparty
wallet UUID. Amounts use exact decimal comparisons; bounds are 0–1,000,000 with
at most two decimal places and minimum ≤ maximum. Counterparty matching covers
both directions, excludes deposits and own-wallet targets, and never grants
access to other wallets' activity. Unknown/unrelated UUIDs give the same empty
result. Counts use all the same predicates as rows.

Merchant payments and refunds have separate type options. A fully refunded
payment retains its stored SUCCESS status; select Refund for refund records.
Advanced inputs validate as one TanStack Form submission. Invalid drafts leave
applied filters unchanged; malformed applied API filters return INVALID_REQUEST.
Changing filters resets page zero and preserves size; bookmarks, reloads and
back/forward restore applied inputs. Clear filters clears applied inputs and drafts.

## Browser scenario

1. Register two unique local demo accounts. Fund one with NPR 1,000.
2. Transfer NPR 25.25 and 50 to the other wallet. Enroll the recipient as a
   merchant, pay a NPR 25.25 request, and issue its full refund.
3. Bookmark history with Transfer type, bounds 25.25–50, exact counterparty and
   size one. Verify two matches, one per page, and reload page two.
4. Switch to Merchant payment then Refund; each shows its own receipt.
5. Apply an unknown wallet UUID. Verify the accessible “No matching transactions”
   Empty state and zero matching count. Clear filters to restore all five rows.
6. Verify a reversed amount range leaves the current URL untouched and explains
   the error. Correct it, apply all advanced fields, paginate, clear, and go back
   to restore the combined bookmark.

Automated coverage: `frontend/e2e/advanced-history.spec.ts` uses the real API and
PostgreSQL; `session-history.spec.ts` covers browser navigation and query parameters.
PostgreSQL TransactionTests additionally cover inclusive/exact bounds, incoming
and outgoing counterparties, ownership-scoped counts, deposits, invalid bounds,
unknown/unrelated/self targets, and unchanged financial records.

## Validation

Validation on 2026-10-01: backend `./mvnw spring-javaformat:apply verify` passed
218 tests, including 29 PostgreSQL transaction-history cases and the complete
admin/freezing and merchant/refund regressions. Frontend formatter, lint/type
checks, all 46 unit tests, and production build passed. All 10 browser acceptance
tests passed against the source-rebuilt Compose/Nginx stack at
`http://localhost:13000`. T3 interactive verification confirmed amount bounds,
invalid-range rejection without URL changes, correction of either bound, unknown
counterparty empty results, and clearing filters. Existing container settings,
ports and the `payflow_postgres_data` volume were preserved.
