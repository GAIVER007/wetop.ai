# MV4 Beauty Domain Acceptance & Hardening

2026-10-04. Scope approved by owner after MV3 acceptance. MV3 merged as bc9b179f.

## AS-IS

Migrations 44/45 already provide all ten Beauty tables, organization RLS, ownership triggers,
GiST employee overlap exclusion across locations and pinned function search_path.
Existing catalog, schedule and appointments services implement CRUD/archive, overrides, assignments,
weekly intervals, absences, snapshots and audit. CustomerBusiness is created inside appointment transaction.
Existing integration tests cover ordinary operations but do not prove concurrent API requests.
No dedicated customer listing route exists. Scope currently chooses first Beauty business/location.
Empty EmployeeService currently means unrestricted eligibility. Appointment status updates read before
transaction, allowing stale transitions. SessionGuard blocks READ_ONLY HTTP writes; domain services lack
an independent transactional write gate. Capability decorators are absent on Beauty controllers.

## Implementation sequence

1. Red tests for explicit scope, capability metadata, empty employee skills, READ_ONLY and concurrent transitions.
2. Explicit Business scope and optional validated Location; require Location for appointments, location service,
   working hours and timezone-dependent schedule views/time-off actions. Catalog and employee business operations
   remain available with Business scope. All writes recheck organization, Business and selected Location in transaction.
3. Capability boundary using canonical registry and existing permissions. Customer listing under beauty.customers,
   desk permission, CustomerBusiness predicate. No customer mutation API or UI expansion.
4. Harden appointment concurrency and explicit service eligibility, preserve current snapshots and statuses.
5. Acceptance integration tests using isolated local PostgreSQL only, full unit/integration/typecheck/lint.
6. Endpoint matrix, evidence report, commit/push/PR, STOP before MV5. No production rollout or migrations.

## Threat boundaries

Client scope pointer is untrusted until AuthorInterceptor resolves membership/Business/Location. Body/query
cannot replace that context. Organization RLS is not Business visibility: API predicates enforce Business
ownership and CustomerBusiness visibility. Transaction checks protect writes after request guard execution.
Exclusion constraint remains final overlap arbiter even when concurrent requests pass preflight.
