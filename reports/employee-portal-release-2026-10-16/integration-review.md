# Final independent integration/readiness review

## Verdict: CONDITIONAL COMMIT READINESS

**No remaining required source-level integration blocker identified in the representative combined-source review.** SPEC PASS and QUALITY APPROVED are supported by the inspected current implementation. Commit readiness remains conditional on actual final frozen-candidate execution evidence. This is not an all-gates-green statement, merge authorization, deployment authorization or production-readiness claim.

## Scope and method

- Inspected the explicitly assigned repository `/srv/hermes/workspace/wetop-portal-release-61af7b90`, observed HEAD `c46ef1c52`, and its candidate tracked/untracked source inventory.
- Read actual `final-spec-rereview.md` and `final-quality-rereview.md`, rather than relying on their supplied verdict labels. The former closes R1/R2; the latter closes Q1/Q2 and explicitly distinguishes its targeted executed evidence from the parent's pending final matrix.
- Independently inspected representative API authorization, identity/scope resolution, public projection/cache policy, schedule/pay/media implementation, web transport/actions/cabinet/public page, booking retry handling, restore harness and release workflow wiring.
- Computed the three quality-report SHA-256 values again: lead-script.ts, site-booking.spec.ts and employee-portal-portability.test.ts all match the quality rereview exactly. This binds that focused approval to these current files, not to every file in the candidate.
- Read-only review: no tests/builds, DB calls, production actions, source changes, Git mutations, environment/auth-state/secret reads or interruptions of the parent's gates. Generic review-skill mutation testing was deliberately excluded under the read-only instruction. The sole written file is this external report.

## Combined integration findings

| Boundary | Independently observed source evidence | Assessment |
| --- | --- | --- |
| API registration and three audiences | `apps/api/src/app.module.ts` registers EmployeePortalModule. `employee-portal.module.ts:12-55` separates staff manager routes from self routes, with self passing null identity and no account/publication/pay-management routes. `employee-portal.service.ts:23-55,136-143` independently resolves verified active membership, business/branch assignment and unambiguous self mapping, then checks privileged writes again. | No disconnected controller or frontend-only authorization boundary found. |
| Private schedule edits and warnings | `employee-portal.service.ts:111-134` checks only own upcoming busy appointments across assigned active business branches, uses each branch's timezone and canonical fitsSchedule, bounds inspection to 500 with explicit truncation, and returns a narrow conflict projection. `:160-171,203-204` preserves branch/revision/employee ownership and reloads the DTO after committed writes. `cabinet.tsx:54-70`, `my-work/actions.ts:50-61` and `employee-portal-api.ts:19-21` connect actual week/absence controls, results and incomplete-check warnings. | R1 closure is present in the combined implementation, not just in a report. No appointment cancellation/payment writer added here. |
| Public withdrawal and private/public transport | Public controller sets `Cache-Control: no-store` before resolution (`employee-portal.module.ts:74-77`). Service constructs a separate published/consented public allowlist (`service.ts:252-269`). Anonymous transport uses no private portal transport/session and no-store (`employee-portal-api.ts:27-38`); `/specialists` is explicitly public entry. | R2 closure and audience separation are consistent across API and web. Signed media/browser retention remains a separately documented limitation, not immediate byte revocation. |
| Payroll and media honesty | `service.ts:67-89` uses existing Food payrollTotals and returns SELECT_LOCATION rather than branchless invented monetary totals. Beauty earnings/remaining remain null with an explicit unsupported/not-configured explanation. `:219-250` requires actual storage, deduplicates employee-owned processed-media retries and compensates only the newly stored object. Cabinet renders unavailable calculations honestly. | No new Beauty payroll formula or fake storage success observed. Logical removal is not physical erasure. |
| Booking retry quality fix | Current lead script `:86-87,112-144` preserves attempt identity until validated success, resets consumed CAPTCHA after received Beauty errors, clears stale availability on 409, and preserves ambiguous network/invalid-success retry identity. Current quality-file hashes match the independent quality approval. Public page `specialists/[slug]/page.tsx:41-47` derives per-service links from the existing validated booking target. | Q1 fix is integrated without replacing the booking backend or introducing an alternate financial/auth rule. Q2's matching suite inventory is present in the actual config. |
| Existing calendar and financial paths | `git merge-base --is-ancestor c3093496e HEAD` returned success. Inspected working-tree diff for Beauty/Food appointments paths and restaurant.service.ts is empty. Current base is the fetched-main candidate specified for this review. | Already published compact-calendar lineage is preserved, not republished or replaced by this change. |
| Final schedule wording | `beauty/schedule/board.tsx:275,431` contains the explanatory ordinary-week and dated-exception paragraphs with colons. These distinguish recurring days off from dated absences and explain that bookings are not automatically cancelled. | The reported final wording adjustment is presentation-only in the inspected paragraphs. No logic change or U+2014 in those additions. No broader post-review history claim is inferred without a complete prior snapshot. |

## Release workflow and restore integration

The tracked `.github/workflows/release-checks.yml` diff is limited to adding the standalone restore command after the existing migration check and adding `employee-portal-ui` to the existing UI-vertical matrix:

- Existing DB job: `:147-152` runs `scripts/ops/check-migrations.sh`, then the standalone restore Vitest config using MIGRATION_CHECK_URL. This is not a replacement for integration/e2e; existing subsequent DB integration and browser steps remain.
- Existing UI matrix: `:240-285` includes employee-portal-ui and invokes its real checked-in Playwright config through the existing generic matrix command.
- Portal config `tests/employee-portal-ui/playwright.config.ts:20-24` includes both `portal.spec.mjs` and `site-booking.spec.ts`, serial worker count one. The current reports describe ten portal plus twelve booking cases. Completion of the parent's all-22 final execution remains an explicit condition below.
- Standalone restore config does not load the shared integration setup or .env. Its test requires an explicit disposable URL, checks loopback and dedicated local port or isolated GitHub DB conditions, exercises the existing stock restore script against randomly named disposable databases and covers optional roles absent/present (`tests/restore/employee-portal-grants-restore.test.ts:8-17,48-136`).
- Migration129 is ACL-only replay of128 rights, with conditional revocation for optional roles, no role creation, no schema/data/RLS rewrite, and no internal transaction ownership.
- No new deployment mechanism, new workflow deployment permission, test waiver or narrowed replacement suite is introduced by the inspected workflow diff. Existing lint/type/unit/site/bot/DB/UI jobs and owner-merge/release gate remain separate obligations. Existing stock restore and deployment tooling were not changed by this candidate's tracked diff.

## Existing execution artifacts checked, not rerun

- `final-migrations.log` ends in `RESULT: OK`; programmatic inspection counted **133** successful rollback-return-to-prior-schema lines, including126/127/128/129. This corroborates the completed migration-chain/down rehearsal. Parent context additionally states zero drift; it must retain the full recorded migration evidence rather than treating this review as a fresh run.
- `final-restore.log` records **1 passed test file, 2 passed tests**. This agrees with the actual absent/present optional-role cases and real no-privileges dump/stock-restore source.
- These are existing local execution artifacts, not production DB facts. The later README-only change does not change SQL. No attempt was made to recertify the still-running/recent final3 gates from partial logs.

## Conditions before committing or handing off as verified

1. Parent must attach actual final frozen-source results for full integration, the complete 22-case portal/booking browser run, root/API/web typechecks, lint, production web build, worker bundle and full unit suite. Do not infer green from these review verdicts or earlier targeted runs. Failures, skips, flaky outcomes, interruptions and codeChangedDuringRun must be disclosed and resolved under the normal gate policy, not waived.
2. Preserve source/evidence correspondence through commit preparation. New files are currently untracked, so staging must deliberately include the actual portal API/web/domain modules, migrations128/129 and rollback documentation, both browser suites/config, standalone restore harness and regression tests. A tracked-only diff is not the whole candidate. Generated next-env.d.ts path churn should be deliberately assessed against the final clean build/type evidence rather than silently mistaken for a portal requirement.
3. Retain the accepted UI evidence for320/390/1440, both themes and keyboard/accessibility behavior. The SPEC report explicitly warns that a gallery loop at1440/390 alone is not proof of320 or keyboard acceptance.
4. Owner merges. A local source approval or commit does not replace GitHub release-checks or authorize advancing release manually. If source changes again beyond documentation, reevaluate which approvals and execution evidence remain applicable.

## Production boundaries and non-blocking limitation

Production remains a separate owner-controlled readiness decision. Outstanding external requirements include authorized backup/preflight/schema-ledger review and production application of pending migrations, including upstream126/127 where actually pending; real Kazakhstan private S3 privacy/signed delivery/retention verification; and authorized Cloudflare/domain publication plus an actually eligible managed-site deployment. No production migration, root helper, Cloudflare deployment or production action was attempted or authorized here.

Logical media removal does not reclaim old blobs, and deleted portfolio metadata may leave EmployeeMedia rows. This is the existing non-blocking retention limitation from both rereviews, not a reason for destructive cleanup during the freeze. Do not describe removal as physical erasure.

## Final disposition

**Required remaining source fixes: none identified in this integration review. Conditional commit readiness: yes, after real final gates and evidence/source correspondence are confirmed. Production readiness or publication: not claimed.**
