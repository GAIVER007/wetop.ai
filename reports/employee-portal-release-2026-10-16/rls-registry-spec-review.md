# Independent narrow SPEC review: portal RLS registry

## Verdict: PASS

No required SPEC issue found in the final five-line registry addition. It corrects an omitted inventory of already approved tenant tables, not a new model, business rule or permission change. This verdict is confined to this addition and does not assert full-suite readiness, remote publication or deployment.

## Scope and method

- Reviewed repository `/srv/hermes/workspace/wetop-portal-release-61af7b90`, observed local HEAD `d02dcbf00` and the working-tree diff in `packages/database/src/rls.ts`.
- Read root `AGENTS.md`, the relevant review skill, prior SPEC/QUALITY/integration report context, approved model contour, migration128, Prisma mappings, registry source and all discovered source consumers.
- The tracked source diff observed was only the comment and four names at `packages/database/src/rls.ts:85-89`, immediately after `employee_services`.
- An active database lock was observed. It was left untouched. This explicitly delegated read-only review did not run tests, builds or DB calls, modify source/tests/Git, inspect environment/auth/secrets, or interrupt the parent's gates. Generic mutation-test guidance was excluded because source and execution are frozen.
- The only reviewer-written artifact is this external report.

## Findings

### Approved identities and existing policies: PASS

`DATA_MODEL.md:3` approves the employee-public-profile, media, portfolio and Beauty percent-basis configuration contour, while preserving existing restaurant calculations and payouts. The addition exactly matches the existing Prisma table mappings and migration128 table identities:

| Registry entry | Prisma mapping | Migration128 creation | Existing tenant policy |
| --- | --- | --- | --- |
| `employee_public_profiles` | `schema.prisma:3188` | `migration.sql:3` | Employee to Business to organization, lines58-60 |
| `employee_media` | `schema.prisma:3205` | `migration.sql:13` | Employee to Business to organization, lines58-60 |
| `employee_portfolio_items` | `schema.prisma:3222` | `migration.sql:23` | Employee to Business to organization, lines58-60 |
| `beauty_payroll_policies` | `schema.prisma:3230` | `migration.sql:33` | Business to organization, lines63-64 |

Migration path: `packages/database/prisma/migrations/20261016000128_employee_portal/migration.sql`. The first three tables already receive ENABLE ROW LEVEL SECURITY and `rls_tenant` with both USING and WITH CHECK through the employee ownership chain. The fourth already receives the corresponding policy through Business. All four names are in the tenant list, not the consciously unscoped list. The registry change adds no schema, grants, policies, functions, role selection or public resolver behavior.

### All discovered source consumers: PASS

Repository-wide content search and tracked-source `git grep` agree on the source reference inventory:

- `packages/database/src/rls.ts:13`: declaration. The remainder of this module, including `applyTenant` and `TenantPool`, does not consume this list.
- `packages/database/src/index.ts:17-23`: unchanged re-export only.
- `tests/integration/rls-isolation.test.ts:6,104-122`: import and complete-schema inventory/catalog equality assertions. Adding the four actual RLS tables restores the asserted inventory rather than excluding a failure or relaxing an expectation. The `bar_` FORCE check at line118 is unaffected.
- `tests/integration/rls-isolation.test.ts:125-142`: tenant-isolation traversal now includes these four tables under the same existing own/other organization checks.

No other source consumer was found. In particular, no runtime authorization or financial writer is driven by this inventory. The change expands existing verification coverage without changing permissions or inventing payroll rules. Traversal can inspect empty tables, so its green result alone is not proof of seeded portal-row isolation; no such broader claim is made here.

### Existing red/green evidence: PASS for the narrow correction

Read existing parent-produced evidence, without rerunning it:

- `/srv/hermes/workspace/wetop-portal-release-evidence-61af/full-integration-rootcause.log:180-198` records the unchanged schema-inventory assertion failing at `rls-isolation.test.ts:112`, with exactly `beauty_payroll_policies`, `employee_media`, `employee_portfolio_items`, and `employee_public_profiles` received instead of an empty unknown-table list.
- `/srv/hermes/workspace/wetop-portal-release-evidence-61af/rls-registry-green.log:3-6,11,176-177` records the focused closed-folio/reset-token/RLS command after registration, with the six-test RLS file passing and 31/31 tests across three files passing.

These artifacts support a genuine existing regression going from red to green, not newly weakened assertions. The separate owned-local pool-size adjustment addresses concurrency observation capacity and is not part of the reviewed source diff. Neither this focused log nor this review establishes completion of the parent's subsequent whole-integration/browser/type/lint/build/unit matrix.

## Disposition and limits

**PASS. Required changes: none.** The addition is a spec-conforming registry repair for the approved migration128 tables. Prior review approvals are not being promoted into an all-gates-green claim. Final frozen-source gate results remain the parent's responsibility. Production migration/application, external provider prerequisites and release authorization remain unchanged. No remote branch, push or deployment success is inferred.
