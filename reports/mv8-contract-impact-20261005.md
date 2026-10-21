# MV8 STOP: missing Food branch contract

Historical report. Blocker resolved by PR #248, merged at dd763f5cee621f5bb8e3e08a72fe3d25880e1bcc. Implementation resumed on the preserved MV8 branch. Final evidence: mv8-vertical-today-20261006/README.md.

## Status and exact base

Owner-authorized implementation, base 04e532b656fd96f1a526f01d3257e75caf595745.
Own checkout /Users/urijzapojnov/wetop-mv8-20261005, branch codex/mv8-vertical-today-20261005.
MV8 DoD not achieved. No PR, commit/push, merge, release or production operation performed.
STOP follows the owner's explicit exception: missing mandatory API contract.

## Confirmed missing contract

GET /branches does not expose active FOOD_SERVICE Business/Location without Property.
apps/api/src/hotel/branches.ts:103 queries only BEAUTY locations; lines 112-116 combine Hospitality properties and Beauty locations. No Food projection exists.
Required existing branch shape for Food: id, name, locationId, location.businessId, vertical=FOOD_SERVICE, current timezone, currency, address and existing count fields. It must enumerate only owned accessible active locations, preserving actual server scope and permissions.

## Real evidence

Test: tests/integration/mv8-branches-contract.test.ts.
Actual pipeline: HTTP GET /branches with a synthetic owner's Food scope pointer -> real HotelModule/BranchesController -> RoleGuard -> AuthorInterceptor -> real BranchesService -> own UTF8 PostgreSQL port 55783, pms_test.
A real ACTIVE organization, FOOD_SERVICE business and location with timezone Asia/Dubai were persisted. Only identity and DB fixtures were synthetic. No domain response replacement.
HTTP status assertion 200 passes; required Food branch assertion fails: actual items=[].
RED log: tests/runs/logs/2026-10-05T18-44-28Z-integration-db22.log.
Earlier direct-service RED: tests/runs/logs/2026-10-05T18-43-47Z-integration-d73f.log.
Both probes cleaned their synthetic organization/user/business/location in finally. Recorded fingerprints remained unchanged.

## Impact

1. Food /today cannot obtain the approved verified selected Location timezone/name through selectedWorkspaceBranch (apps/web/src/lib/workspace-context.ts:16-21), which returns null.
2. Food planned/completed/confirmation/no-show/unassigned counts need correct local today. The Food reservations API requires an explicit date, does not return Location timezone, and selects rows by local start day (food.service.ts:320-344).
3. Overnight seated/free-table facts need current and previous local dates. A guessed/default/browser timezone could omit occupied tables or the previous-day seating and produce false free counts.
4. Existing selectBranch reads GET /branches and rejects an ID absent from items. Hotel -> Food, Beauty -> Food, Food A -> Food B and reload/scope acceptance cannot be demonstrated through the real application.
5. Shell metadata/timezone shares this branch lookup. This is a pre-existing contract gap on the required base, not a proposed MV8 model expansion.

## Why not substitute another source

/auth/me scopeView exposes verified IDs/vertical but no timezone/name.
Food areas/tables/reservations contain no Location timezone projection.
/onboarding returns draft, with saved.draft preferred over current Location values (onboarding.module.ts:109-122). A draft is not an authoritative live Location timezone, and does not enumerate branches for switching.
Existing tests/food-ui/fixture-api.ts synthesizes /branches directly from all locations; this masks the real BranchesService omission. Using it to report real MV8 matrix GREEN would be misleading. The unrun draft MV8 browser harness was discarded; the real HTTP contract probe is retained.

## Work preserved, not completion claims

21 focused tests GREEN: Beauty/Food builders, minimal loaders, verified scope helper and navigation expectations. RED before GREEN logs retained.
Provisional frontend composition/navigation changes remain uncommitted in the isolated branch. They are not accepted UI, have not passed full regression/visual/real API DoD and must not be merged.
Initial web typecheck failed for an icon name, corrected locally; second web typecheck passed. Full root/API typecheck, full unit/integration, visual/accessibility and migration rehearsal have not been claimed or completed.
Backend/schema/migrations untouched. No shared Supabase or foreign process/worktree used.

## Minimal unblock, requires separate authorized backend work

Extend the existing GET /branches read projection to return accessible Food locations with current Location fields and exact FOOD_SERVICE vertical, with real-controller integration evidence. No new financial rule, generic booking domain or schema change is needed.
This is outside the approved MV8 no-backend scope. After an authorized upstream fix, synchronize this isolated branch and resume the approved MV8 checklist from real scope/API acceptance, repeating affected tests. The present authorization does not permit silently implementing that backend fix.
