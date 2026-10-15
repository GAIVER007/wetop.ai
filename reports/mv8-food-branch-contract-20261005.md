# MV8 Food branch read contract

Base: 53d355d88b563329c33edd72563be81704eb5b89, fresh-main sync unchanged.
Branch: codex/mv8-food-branch-contract-20261005. Own clone, UTF8 PostgreSQL 55793, PGDATA /tmp/wetop-mv8-unblock-20261005-pg; browser/API 55863/55864. Initial tracked tree/locks clean. Original MV8 branch preserved.

GET /branches adds owned ACTIVE Food Locations without Property to the canonical projection. Current name/address/timezone/currency, locationId/businessId and zero Hospitality inventory counts. Hospitality Property query unchanged; Beauty and Food use shared Location projection. POST /branches remains Hospitality/Beauty, explicit Food creation rejection verified. No schema/migrations/reservation/financial changes.

Evidence: fresh-main actual HTTP contract RED (2026-10-05T19-42-15Z-integration-8699.log), projection unit RED (2026-10-05T19-42-23Z-unit-bcec.log), focused 24 unit GREEN, real HTTP matrix and Beauty catalog 11 integration GREEN. Full integration: 748 passed, 9 pre-existing conditional skips (backup/restore and held wizard). Existing Beauty branch integration included.

Real matrix in one database: A has Hospitality Property, Beauty Location, Food A1/A2/B1; B has Food. Exactly five A items, no B/archived Business/archived Location; B request cannot see A even with A scope pointer; signed-out 403; Food POST 400. Current Location timezone update reads back despite stale onboarding draft.

Real browser test: actual HotelModule/BranchesController/RoleGuard/AuthorInterceptor/PostgreSQL. Synthetic only identity and fixtures, no domain payloads. Food branch -> server selectBranch -> httpOnly scope cookie -> selectedWorkspaceBranch/real floor-plan -> Food A1/A2/B -> Beauty calendar -> Hospitality Today, reload retains context. Final browser smoke passed with exact landing and cookie assertions.

Review: Organization and ACTIVE predicates retained, Property null predicate retained, no RLS/AuthorInterceptor change. Shape exact, no frontend enum, no extra write capability, no paid external/production calls. No dependency change. New integration cleanup marker-bound to synthetic org IDs.

Full unit initially had one unrelated 5000ms timeout in auto-deploy.test.ts under concurrent local checks. Failed log retained; no timeout/assertion/skip changes. Final results appended below.

Migration chain/authoritative schema drift/all downs: RESULT: OK (65 migrations). No schema or migration diff. Root/API/web typecheck and lint GREEN. git diff --check GREEN.

Final full unit: 3400 passed, 4 existing conditional skips, default timeouts. Final log 2026-10-06T07-21-43Z-unit-512d.log. Full integration 748 passed/9 existing skips, log 2026-10-06T07-16-17Z-integration-2016.log. No new skips or weaker assertions.

PR #248 synced fresh main 34038a8d031cb76cc0685cc46e41ca0dcd04f9ec. Upstream contains only regression/evidence, no apps/packages change. Affected checks repeated: 24 branch unit, 8 real HTTP/Beauty branch integration, 1 real branch browser smoke GREEN. Review/comments inspected: no unresolved feedback.
