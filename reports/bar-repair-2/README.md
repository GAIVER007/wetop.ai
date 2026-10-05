# BAR-REPAIR-2: dispatch and Property ownership repair

Date: 2026-10-05. PR: https://github.com/GAIVER007/wetop.ai/pull/245.
Original base: abe59d83693655f87c51059a8e1915196d35d07f.
Fresh main incorporated by merge 7f4873cb: e86c0af594e858a5eee72ae7cc3722d10ed7d03c.
Main changes affect finance/mobile calendar UI and UI tests, with no new BAR migration or code.
The last sync changes only UI tests/journals, leaving integration and migration inputs unchanged.
Only an isolated clone and dedicated localhost PostgreSQL 16 were used. The original
checkout, shared dev database, production and release remain untouched. MV6/MV7 not started.

## Implementation

- Migration 55 fixes bar_property_guard row-type dispatch, preserving pinned path and
  failing closed on unknown tables. Product does not read supplier_id; receipt does not read category_id.
- Migration 56 enforces BAR parent property immutability, child property/product equalities,
  sale folio/cash/charge links and exact sale.folio_id = charge.folio_id when both are set.
  It prevents receipt-line and lot product edits from invalidating existing BAR children.
- Migration 57 is the separately approved reverse-parent repair. Number was verified after
  fetching fresh main. Migrations 55/56 are byte-for-byte unchanged from head 5641ab09.
  Only cash_operations.property_id, charges.folio_id, folios.reservation_item_id,
  reservation_items.reservation_id and reservations.property_id receive external reverse guards.
  They reject only mutations invalidating existing BAR references, including charge-only chains.
  Same-property relinks and unreferenced external parents remain mutable.

Every new function is SECURITY INVOKER with owning schema, public, pg_temp pinned (public once).
Unknown table/operation fails closed. RLS visibility is independent of ownership validation;
wetop_service retains A+B reads but cannot write inconsistent cross-property links.
Read-only administrative preflight rejects legacy ownership corruption and performs no repair.
A regression disables one guard transactionally, proves preflight rejection, and verifies that
corrupt data was not automatically changed; the entire synthetic fixture then rolls back.

## Concurrency

Parent UPDATE locks conflict with the existing BAR-side FOR SHARE checks. Reverse checks
lock affected BAR sales/payments and new ancestor chains. Real concurrent PostgreSQL sessions
observe pg_stat_activity.wait_event_type = Lock before releasing the winning transaction.
Create and relink are tested parent-first and link-first for both roles and all six external
parent scenarios. Four combinations of READ COMMITTED / REPEATABLE READ are exercised, plus stale
ancestor snapshots after valid Charge/Folio/ReservationItem reparenting (200 cases total).

FOR SHARE alone was insufficient for stale REPEATABLE READ snapshots: run 514c demonstrated
two additional bypasses after the initial reverse guard was green. Migration 57 therefore also
versions only referenced external parent tuples on BAR create/relink using value-preserving
UPDATEs. Approved external reparenting with BAR dependencies also versions its new
ancestor chain; f4a3 first reproduced six ancestor snapshot bypasses. No field values,
prices, cash amounts or booking semantics change. A stale parent
writer now receives 40001, while READ COMMITTED rejects with the ownership guard. Concurrent
lock upgrades can require a transaction retry; an inconsistent commit is never acceptable.
Disposable concurrency schemas contain only generated synthetic data and are dropped after tests.

## RED -> GREEN evidence

Recorded logs and fingerprints: tests/runs/journal.jsonl. No new skips, weakened assertions,
or increased timeouts. All new BAR tests execute on real local PostgreSQL.

| Evidence | Run | Result |
|---|---|---|
| Dispatch before 55 | d763 | 9 FAIL / 3 PASS, missing row fields reproduced |
| Dispatch after 55 | 1de9 | 14/14 PASS including search-path |
| Expanded BAR ownership before 56 | 8956 | 92 FAIL / 36 PASS |
| Initial external parents before 57 | 2f6f | 10 FAIL / 2 PASS |
| Expanded external parent RED | ce0a | 14 FAIL / 6 PASS |
| Parent/link concurrent schedules before reverse guard | 980d | 24 FAIL / 24 PASS |
| Stale REPEATABLE READ snapshot RED | 514c | 2 FAIL / 48 PASS |
| Mixed isolation ownership and concurrency GREEN | 83c5 | 351/351 PASS |
| Stale ancestor reparent RED | f4a3 | 6 selected cases FAIL; other cases filtered, not disabled |
| Complete final BAR boundary GREEN | 9d22 | 378/378 PASS, including 200 concurrency cases |
| Final full unit after main sync | e08b | 3368 PASS, 4 existing skips, zero FAIL |
| Final full integration after main sync | 9a0b | 716 PASS, 11 existing skips, zero FAIL |
| Final root/API/web typecheck after latest sync | 0b4f | PASS |
| Final lint after latest sync | 9b99 | PASS |
| Full chain, schema drift, all 63 down rehearsals | migration-rehearsal.txt | RESULT: OK |

Earlier environment/fixture diagnostic failures are retained transparently, not claimed as
security RED evidence: c825 SQL cast; 3777 invalid accommodation enum; SQL_ASCII/timezone
cluster defaults; shell locale; excessive worker load. Final local cluster: UTF8, en_US.UTF-8,
UTC. Unit uses LC_ALL=C. A loaded parallel full run fb2e timed out seven existing shell
cases; b962 reran the unchanged two files sequentially, 24/24 PASS. Final full unit uses
maxWorkers=1 with all original timeouts. Latest main introduced an inline mobile CSS
variable which the token checker falsely reported missing (78d0). The checker now reads
actual inline declarations, without a new allowlist entry: 6a33 15/15 PASS; removing the
real declaration still causes 80e8 RED. The temporary component edit was restored.
509e was deliberately interrupted before the final ancestor fence refinement; it is not
claimed as GREEN evidence. Existing skips predate this PR.

## Populated RLS matrix

Each cell shows [A,B] selected by fixture IDs, with identity assertions. A fresh session per
table proves unset app.org_id is truly absent; empty context is checked separately.

| Table | app A | app B | absent | empty | service |
|---|---|---|---|---|---|
| bar_categories | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_products | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_receipt_lines | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_receipts | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_sale_lines | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_sales | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_stock_lots | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_stock_movements | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_supplier_payments | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |
| bar_suppliers | [1,0] | [0,1] | [0,0] | [0,0] | [1,1] |

50/50 role/table checks PASS. Ten tables FORCE RLS; service BYPASSRLS; app neither superuser
nor BYPASSRLS. Direct app writes to foreign Property and child/linked ownership writes deny.
Same-property valid writes pass under both roles. Fresh unused cash prevents uniqueness from
masking ownership rejection. BAR unit/API/web behavior is included in the full unit suite.

## Scope and release

Q-BAR-REVERSE-PARENTS closed after renewed full GREEN.
DATA_MODEL and DECISIONS record both invariants and the snapshot concurrency refinement.
source_type/source_id remains a separate audit item; no concrete cross-property source lookup
exploit was reproduced, and no polymorphic ownership model was introduced.
No API, Prisma shape, money arithmetic, FIFO, status, Beauty or Food changes in this repair.

Operational application rollback retains 55/56/57. Their down.sql files are disposable exact
schema rehearsals, not production rollback: 55 restores a known broken body, 56/57 remove
ownership protection. Before a separately approved production apply: backup via pg_dump,
run the read-only preflight with administrative visibility, apply forward migrations,
validate ownership and role matrix. Any correction must preserve the working guards.
No production migration or deployment occurred. Draft removal/merge requires final GREEN,
fresh main review, mergeability and review/comment checks. Merge SHA is reported in the chat.

## Final review

Correctness: 378 focused cases plus full regressions, real lock waits and stale snapshot
probes. Security: invoker functions, pinned paths, app/service ownership parity and complete
RLS matrix. Architecture: only forward migrations, 55/56 unchanged, no model/API shape
change. Readability: explicit table dispatch. Performance: no-op field assignments return
early in reverse checks; tuple version fencing touches referenced chains only.
All final recorded suite fingerprints match the current source; docs/journals are excluded
from code fingerprints. Final unit ran alone with one worker and unchanged timeouts.
