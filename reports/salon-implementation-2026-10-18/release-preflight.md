# Push and release preflight, 18.10.2026

## Result: pushed, NOT deployed

The user explicitly authorized push/site release and continuation after the local core handoff. Branch `feat/salon-draft-implementation-20261018` was pushed without force; GitHub readback confirmed `71c57164aa13069d973787c06e369eefae76ea28`. Draft PR: https://github.com/GAIVER007/wetop.ai/pull/677.

Fresh origin/main was still `8a5ab9480109ca7881df6d7a856b1a17cea135d9`, with no missing main commits in the candidate. Latest main release-checks39147447425 failed on two lint findings already fixed by the branch; the UI aggregate failed because its dependencies were skipped, not because a UI browser scenario had executed and failed.

## Gate preparation completed

Three remaining bar unit failures were reproduced on the unchanged source: recorded `2026-10-18T18-37-55Z-unit-078d`,25passed/3failed. Root cause: two `currentMe` fixtures lacked user, organization, business and expiry required by the actual retail recovery authorization boundary; their location also differed from the submitted tuple. Changed ONLY those two synthetic fixtures in `apps/web/src/app/bar/actions.test.ts`,6added/2removed lines. No production bar/restaurant code, money rule, guard or assertion changed.

- Targeted GREEN28/28, including the original nine negative authorization cases: `2026-10-18T18-38-35Z-unit-cbf8`.
- Full unit6193passed,0failed,7preexisting skips out of6200: `2026-10-18T18-38-53Z-unit-5bf6`.
- Root/API/web typecheck passed: `2026-10-18T18-42-35Z-typecheck-ecbf`.
- Lint passed: `2026-10-18T18-43-39Z-lint-bc0f`.
- All five journal entries report no source mutation during the run. Source review `deleg_2f95ff37` passed; see `release-fixture-review.json`.

Earlier core20/20 DB integration and strict schedule1/1 remain scoped core evidence, not proof of the full release gate or all94scenarios.

## Actual isolated database release blocker

No production or shared DB was used. Created the separate owned UTF8 database `salon_release_preflight_20261018` on the existing owned PostgreSQL cluster at loopback55983. Applied all136 ordinary migrations through the canonical `test:schema` runner with synthetic seed; latest ordinary migration remains `20261018000132_customer_imports`.

Actual Prisma7.10 diff against this ordinary-only test schema returned exit2 and requested ten absent Beauty tables: positions, permissions, assignments, employee service prices, service materials, material revisions, appointment lines, appointment reviews, review invitations and location hours. This confirms the held schema release is not optional for the current candidate. The seeded test schema also contains two test metadata tables; their suggested removal is test-only noise, not a production repair instruction.

Applied ONLY the existing five Beauty held SQL files in their documented dependency order to this owned local DB; all five returned0 and SQL readback found all ten tables. No source migration moved/promoted, no new migration/model authored. Up/down SHA256 manifest is retained in `release-preflight.json`. Production release names remain prospective133-137, because ordinary131/132 are occupied, per `docs/ops/beauty-zapis-release.md`.

A second diff still returned2: constraint/index naming, updated_at/id defaults and customer-import FK update behavior differ between SQL and Prisma declarations, in addition to the two test metadata tables. These need deliberate declaration/SQL reconciliation preserving existing guards, not automatic execution of generated diff SQL. **Neither generated diagnostic SQL was executed.** Full private diagnostic logs are in the external `salon-implementation` evidence directory.

This is a focused diagnostic against a canonical seeded pms_test schema, not a claim that the full fresh-apply/down release suite or GitHub DB job was run.

## Cutover access and current health

Approved read-only `wetop-ops status/health` reported API/web healthy and internal health200; clone/deployed marker29fd2fda. Image SHA labels are ABSENT. Marker is NOT complete image provenance. Package-check returned1, classifying3files CANDIDATE and6OTHER; this does not prove a coherent current candidate image.

No production auth/session files or credentials/PII were opened/copied. No production DB writes, maintenance, service restarts, migrations, merge or release-branch movement were attempted. No expensive GitHub release-checks was dispatched into the confirmed schema blocker. No checks were weakened/skipped to get a release.

## Required next authorization and verification

1. Separate approval to prepare/promote the canonical five-file Beauty schema release133-137, after reconciling declarations with real SQL without weakening constraints. Do not include unrelated held114-118.
2. Exact candidate green release-checks plus fresh apply/down, populated backfill, restricted-role RLS and retained-data rollback-guard tests.
3. Explicit production migration authorization pinned to the final immutable commit/image, current migration-status readback, trusted fresh backup and isolated restore-check. Prior runbook observation that ordinary132was pending is historical, not a fresh production query.
4. Owner-provisioned trusted backup/migration/cutover runner. Existing no-arg migration helper alone grants neither approval nor the `wetop-auto-deploy --migrations-applied <SHA>` cutover call.
5. Normal main/release progression, image/build provenance and authenticated live salon smoke only after these gates. Generic permission to push/deploy is not a production schema approval under AGENTS/runbook rules.

Own PostgreSQL ownership was re-proved by current_database/data_directory/port before stopping it. Cluster and all evidence are preserved. Tree stays ACTIVE/KEEP; unrelated dirty .gitignore, premium screenshot and old untracked work are untouched.
