# MV6 approved implementation plan

Base main abe59d83693655f87c51059a8e1915196d35d07f; clean isolated clone, no locks, local PostgreSQL 55753 only. Read architecture v3, platform plan, model and ADR. Search apps/api/packages: no Food domain or equivalents. Upstream abe59d83 only BAR RLS, not Food.

1. Record approved DATA_MODEL §28 and ADR-MV6 before Prisma.
2. Red/green pure domain parsing, status, period/timezone/overnight, capacity, normalized fingerprint.
3. Add five tables, enum, FK/checks/ownership guards/pinned functions/RLS; canonical free migration 20261005000055_food_service_domain (latest upstream 54). Empty down succeeds; populated down refuses.
4. Nest Food module using explicit verified Business and Location, parent locks/recheck READ_ONLY, transactional audit. All catalog and reservation mutations scoped; no fallback or body scope trust.
5. Real API/PostgreSQL tests: catalog -> customer -> booking -> assignment/move/status/reload; roles/verticals/tenants, constraints/RLS, all specified races and idempotency.
6. Full unit/integration/typecheck/lint/migration rehearsal; PR/report/STOP. No merge permission inferred, no production/release/MV7.

## Exact endpoint matrix

All routes prefix /food-service. Signed-in, ACTIVE explicit FOOD_SERVICE Business AND ACTIVE explicit Location required, including customer read. X-Wetop-Scope resolved by AuthorInterceptor. All GET allowed in READ_ONLY, every mutation 403 before transaction and after parent locks.

| Method | Route | Capability | Permission |
| --- | --- | --- | --- |
| GET | /areas | food.tables | desk |
| POST/PATCH | /areas, /areas/:id | food.tables | property |
| GET | /tables | food.tables | desk |
| POST/PATCH | /tables, /tables/:id | food.tables | property |
| GET | /service-periods | food.tables | desk |
| POST/PATCH | /service-periods, /service-periods/:id | food.tables | property |
| GET | /customers | food.tableReservations | desk |
| GET/POST | /reservations | food.tableReservations | desk |
| PATCH | /reservations/:id | food.tableReservations | desk |
| POST | /reservations/:id/status | food.tableReservations | desk |
| PUT/DELETE | /reservations/:id/table | food.tableReservations | desk |

GET reservations requires date YYYY-MM-DD and returns starts within that local day, with nullable table+area, Customer name/phone, ServicePeriod name, status/source/notes, updatedAt and next statuses. Lists use {items}; optional cursor id and limit 1..100 (default 100), nextCursor. UTC timestamps serialized ISO. Catalog PATCH changes supplied fields only; parent IDs immutable.

POST reservation requires Idempotency-Key (1..200), servicePeriodId, startsAt (offset required), partySize, customerId OR customer {firstName,lastName?,phone?}, optional tableId, notes, source DESK(default)/WALK_IN. Unknown fields rejected, endsAt never accepted. Replay with same normalized payload returns existing even after state changes; different payload 409.

All reservation PATCH/status/assignment/delete bodies require expectedStatus and expectedUpdatedAt; mismatch 409. DELETE body only optimistic token. Assignment PUT also tableId. Metadata PATCH can update startsAt, servicePeriodId, partySize, notes; same table remains, capacity/overlap rechecked. No manual duration or price.

Errors: 400 invalid input/window; 403 missing scope/capability/permission/READ_ONLY; 404 unavailable scoped entity/customer; 409 stale/terminal/overlap/capacity/idempotency collision. Audit avoids customer contact and free-text notes.
