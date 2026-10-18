# Clean-CI root dependency repair

## Cause and scope

Candidate4eae89543 exact release-checks39158206059 failed root typecheck TS2307 at tests/tools/beauty-release-preparation.ts:4: undeclared root import from zod. Local private/hoisted dependency availability concealed this boundary. The downstream UI aggregate also failed because prerequisite jobs were skipped, not because it executed failing UI assertions. Bot passed; no claim of a green full gate.

Replace only the pure test/helper schema validation with Node-built-in exact-object, literal approval/state, literal boolean requirements, exact finite unique five-name block, hash-format and actual-content-hash checks. No package/lock change, no deep workspace imports or new dependency, no product/API/SQL/auth/financial change. Original guard cases remain;14malformed object/type cases added. No skipped tests or timeout increases.

## Frozen-source execution after repair

- Targeted guard52/52: 2026-10-18T19-25-35Z-unit-75fe.
- Root/API/web types PASS: 2026-10-18T19-27-05Z-typecheck-0806.
- Lint PASS: 2026-10-18T19-28-08Z-lint-17e5.
- Full unit6246passed/0failed/7existing skips,6253total: 2026-10-18T19-29-01Z-unit-f4a5.
- Targeted actual PostgreSQL79/79,8files,0skips: 2026-10-18T19-32-50Z-integration-4cc3. Includes fresh141canonical ordinary migrations, populated backfill, Prisma diff0,10FORCE RLS tables/foreign visibility,5retained-data down refusals and reverse legacy preservation.
- Strict real UI/API/DB1/1: 2026-10-18T19-33-09Z-e2e-126a, real restricted role, registration/session,save/reload/onboarding4/4,stale409,demoted403. Independent SQL across the two synthetic schedule runs:2synthetic masters/2persisted Monday intervals/all10:00-18:00=true. These are test data, not production.
- All6recorded repair runs codeChangedDuringRun=false. Six journal/log pairs retained.
- Independent read-only reviewdeleg_3153ed5f: approve,findings=[]; actual verdict preserved in schema-ci-repair-review.json.

## Other old-main failures are not automatically new candidate failures

Readonly inspection of older main2a8 CI39156107469 found missing appointment_lines/Beauty assignments/stock appointment_line_id and declaration drift, consistent with its absent five canonical migrations. Employee-portal startup Food business required also originates from a BEAUTY fixture inventory seed that needs canonical materials135; read-only triagedeleg_4a7f8fde found no independent fixture bug. Do not widen Food authorization or edit fixtures to hide that source/schema mismatch. New full CI is still required to prove those failures disappear; generic UI shard failures are not declared fixed from this analysis.

## Publication and production boundary

This is a verified local repair of published draft PR678, not a successful full GitHub release gate. Publish the exact reviewed repair, update PR candidate, dispatch a single exact-SHA release-checks and track its real result. Main resulting-commit CI is separate if merged. Source prep approval does not authorize production migration; green gate, current production status, pinned compatible code/image, trusted backup+restore validation and separate exact approval/cutover runner remain required. Do not use migration-applied flags or execute the diagnostic schema diff.

Only owned local PG55983 was started/stopped after database/data_directory/port proof; data and child proof databases retained. No production writes/deploy/restart/maintenance/backup. Existing dirty .gitignore/premium screenshot and older untracked remain preserved; tree ACTIVE/KEEP, no cleanup.
