# BAR operational acceptance, 2026-10-07

Status: acceptance incomplete. Financial and access policy decisions remain open.
No merge, deploy, release or production write was performed.

Base: e0089a230d8bd0b03751721d6e219faa628b904e.
Branch: codex/bar-operational-acceptance-20261007.
Own clone, Node 24.15.0, PostgreSQL 16.15, localhost:55893, pms_test.
Synthetic identity replaces authentication only; BAR/Finance controllers, RoleGuard,
AuthorInterceptor, services, repositories and ledger writes are real. SessionGuard
read-only enforcement is not proved by this fixture and is explicitly NOT RUN.

## C01-C16 matrix

| Case | Status | Evidence and limitations |
| --- | --- | --- |
| C01 catalogs | PASS API; browser creation NOT RUN | Category, supplier, two distinct products; unused product archived without stock effects. |
| C02 draft | PASS API; form cancellation NOT RUN | Two lines, receipt total 120000, draft has no stock/debt effects. |
| C03 post | PASS | R1 then R2, sale price 20000 then 32000; repeated post 409, effects unchanged. Browser post and reload. |
| C04 payments | PASS ordinary; policy NOT ACCEPTED | 60000 partial and exact remainder; overpay denied. Finance void succeeds but supplierPaid/debt unchanged. |
| C05 retail | PASS | 12 units, revenue 384000, FIFO cost 132000 across two lots. Browser and reload. |
| C06 Folio | PASS open/unpaid | 3 units, SERVICE charge 96000, FIFO cost 48000, no cash income. Browser and reload. |
| C07 write-off | PASS ordinary | One unit, reason, cost 16000, movement/author evidence; browser and reload. Lost-response replay remains unsafe. |
| C08 inventory | PASS shortage; surplus NOT ACCEPTED | Actual A=3, shortage one unit/cost16000; repeat changes no stock. Zero actual valid. Q-BAR-9 remains open. |
| C09 restock reversal | PASS API | REVERSED/VOIDED, two return movements, stock280000, repeat409. Browser reversal NOT RUN. |
| C10 no-restock reversal | policy NOT ACCEPTED | Stock148000; report revenue/cost/writeOff zero, 132000 cost treatment unresolved. |
| C11 invalid input | PASS API | Negative/zero/fraction/insufficient quantity and overpay leave no partial effects. Broader browser validation NOT RUN. |
| C12 paid/closed Folio | NOT RUN | Expected reversal/payment/refund contract requires owner decision first. |
| C13 retry | PARTIAL; unsafe operations confirmed | Sale replay no duplicate effects; after reversal response now REVERSED. Same key with changed quantity returns original. Payment/write-off repeated requests create two effects. Stable UI intent keys absent. |
| C14 rights | PARTIAL; policy NOT ACCEPTED | STAFF reads/sells, settings403; BAR reverse201 vs Finance void403. Read-only HTTP scenario NOT RUN. |
| C15 isolation | PASS API/SQL | Foreign product/Folio/receipt denied; existing BAR ownership, reverse-parent, FORCE RLS and service-role matrix regressions run. |
| C16 races | PASS | Two HTTP transactions observed waiting at a real PostgreSQL row barrier, then release; one201 and one409 for each last-unit/payment/post/reverse pair. |

PASS applies only to the exact variants described, not the whole case family.

## Accounting reconciliation

All figures are integer minor units. Purchases280000 = sales cost180000 +
write-off16000 + inventory shortage16000 + remaining stock68000.
Revenue480000; sales gross profit300000; supplier paid60000; debt220000;
cash324000; open/unpaid Folio charge96000. Final stock A3/B4.
Six screenshots cover posted receipts, supplier payment, retail FIFO, Folio,
write-off and final inventory. API totals were checked after every browser reload.
Fixture IDs and row snapshots are in JSON files in this directory.

## Minimal fix and red/green

Before fix both retail and Folio replay after reversal returned POSTED.
`2026-10-07T12-03-57Z-integration-332d` contains both failures (and one corrected
fixture assertion using an invalid cash enum). Repository now returns persisted
status; typed web response allows POSTED | REVERSED. No migration or ledger change.
`2026-10-07T12-04-50Z-integration-f46e`: 7/7 pass.
`2026-10-07T12-09-19Z-integration-b5f6`: 11/11, including all four races.
`2026-10-07T12-14-11Z-integration-1d59`: 13/13, including cleanup.
Browser `2026-10-07T12-12-34Z-e2e-bb0b`: 1/1 real cycle.
Security run `2026-10-07T12-13-44Z-integration-fbd1`: all391 assertions passed,
but suite failed during cleanup because append-only audit deletion is forbidden.
Cleanup was corrected to retain audit and its synthetic author, without purge.

## Open decisions

See QUESTIONS.md, BAR operational acceptance. Pending: cost recognition without
restock; paid/closed Folio reversal; restoring debt after supplier cash void;
STAFF/refunds/read-only permissions; replay identity for payments/write-offs and
stable client sale keys. No implementation of these policy changes is authorized.

Cleanup selects only fixture organization IDs and verifies their synthetic marker.
Operational rows are removed; append-only audit and synthetic authors are retained.
Recovery also cleans earlier interrupted fixture runs from this own local cluster.
No real guests, shared Supabase or production data are present in the fixture.

## Upstream impact check

At 12:22 UTC remote main became df0af4b0dd7c05df561ca18bc9cab484256bc4fb.
Changes add Marketing generation-run migrations62/63 and its contracts, plus
shared documentation/test journals. No BAR implementation/migrations changed.
This report's base remains e0089a23 and its 64 migrations; results do not certify
new remote main. No automatic rebase or merge has been performed.

## Regression evidence

- typecheck root/API/web: PASS, 2026-10-07T12-15-46Z-typecheck-bb84.
- lint: PASS, 2026-10-07T12-16-20Z-lint-a96e.
- full unit: 3769 PASS / 4 pre-existing SKIP, 2026-10-07T12-20-24Z-unit-881e.
  No timeout changes; two workers, direct Git binary and C locale. Initial run's
  missing sparse checkout design assets and shell test failures remain in journal.
- full integration: 852 PASS / 5 pre-existing SKIP,
  2026-10-07T12-17-02Z-integration-c407. Existing wizard tests pin localhost:55432,
  so do not execute on our isolated55893 port; no skips were added.
- final dedicated BAR browser cycle: 1/1 PASS,
  2026-10-07T12-24-59Z-e2e-20ee, with row snapshots and cleanup.
- migration application / schema drift / all64 down rehearsals: RESULT: OK,
  migrations.log. This validates the base64 migration set, not upstream66.
- first full e2e: 24 PASS / 2 FAIL,
  2026-10-07T12-21-36Z-e2e-b167. Inventory expected88 but found89 after integration
  fixture writes. A separate fresh synthetic database pmsbar_e2e was created for
  the repeat. The original schema and audit evidence were preserved.

These results alone do not imply full financial readiness or full unskipped CI.
GitHub release-checks has not been dispatched: no release-candidate/main mutation.

Final general e2e repeat: 26/26 PASS,
2026-10-07T12-26-25Z-e2e-67c7, on fresh pmsbar_e2e. Both inventory failures from
the first run pass with the unchanged assertions. Own BAR fixture organizations
remaining in pmslocal:0 after recovery. Synthetic audit/authors retained.

Scope of certification: the five recorded TESTING.md suites, migration check and
BAR browser/SQL evidence. GitHub release workflow, bot pytest, separate site/UI
snapshot workflows and unapproved financial variants are NOT RUN here. No claim
of complete release CI or complete BAR operational acceptance is made.

FINAL_SHA is the delivery branch/PR head. TESTING.md fingerprints preserve the
unit/integration/lint/browser evidence across commits of unchanged inputs; final
`test:status` is saved with the delivery. Only root reports/docs and journals are
updated after recorded code checks.
