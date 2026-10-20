# Unified authorized release candidate, 2026-10-17

Base: freshly fetched origin/main b532b2696ebf3ee9eab79f4f36ac20da0007a915. Branch: integration/all-approved-20261017. Parent owns final merge/deploy decision. No main/release push, source PR closure, production operation, database operation or migration application performed by this integration task.

## Nine inputs

- #610 afb19ac555f85e372e1fb2570a189a7ebc8336b5: vertical-safe navigation, restaurant settings and API-error links.
- #611 7e83faea7b5aae2d2e26190f99d1471237297f24: stacked on #610; deduplicated vertical menus, unified search and profile menu. Shared #610 changes included once through normal ancestry.
- #614 61a555d51dc2a2b21436b2c2ffd8c36b2921f63c: audit action/entity labels and source-derived label guard.
- #616 23f83df5450296bea8316d8f7854d424b46d99e1: unknown revenue is not zero; no invented negative ROMI.
- #617 529e8cba6bf7123178d7e51fab667866f0c7d68e: new chat quotes/bookings require a live sales agent and active extension; idempotent existing booking retrieval preserved.
- #618 0eb52af6da47dad6b7ddedd748c3cff24542a657: media library across verticals; Channex hotel-only; unavailable nonhotel publication explained rather than redirecting.
- #619 24f9e5b157bd0c0c9bc5947af4b693f434c0b934: owner-approved seven-day trial for new organizations; existing trial dates unchanged.
- #621 c78e8c5f91427a1407fe97a55b15e57ad7acc104: explicit disjoint portal fixture routing and two corrected schedule opener locators.
- #620 41ff0ecd4371a342d79da2039a8402d4aadf8811: reviewed and included in merge ancestry, but its entire coupled alternative is superseded by #621. No nonduplicate product change in #620.

## Reconciliation decisions

All product merges applied cleanly via normal merge. No wholesale ours/theirs strategy used. Only design collision: integration fixture safety (#620 versus #621), classified same-question-different-answer. Selected #621 as a coherent whole because it uses the already allowed dedicated CI destination without expanding guards. Explicitly reversed the reviewed four-file #620 patch before committing its merge resolution: workflow marker, portal guard, public-booking guard refactor, and canonical-allowlist tests. Current guard files are byte-identical to main. The #621 workflow routing and two UI locator fixes remain intact. See ADR-RELEASE-FIXTURE-ROUTING-20261017. Full integration remains mandatory; local collection/unit checks are not database proof.

## Verification and safety

- All nine inventory SHAs verified as ancestors of candidate. Durable JSON: /opt/data/workspace/wetop-release-evidence/all-input-verification.json.
- No changes under packages/database/prisma relative to main. No data model/migration introduced by integration.
- Private dependency directory links third-party packages read-only by convention; all @pms workspaces, including scripts/imports, point to current candidate. Generated ORM client copied privately from supplier worktree. No donor installation or regeneration.
- Local typecheck, lint and full unit invoked through test:record, with exact exit results/logs in the checkpoint and journal. Imported source PR evidence is historical, not proof for this candidate.
- Raw git diff --check origin/main HEAD reports inherited source-test blank EOF lines and whitespace in historical test logs. These have not been opportunistically rewritten; this warning is not a green diff check.
- Required full release-checks includes database integration, migrations/restore on disposable GitHub services, full UI shards/verticals/auth, runtime audit, bot, site and supplier regression. No gate is bypassed, weakened or replaced by local results.

## Durable handoff

Checkpoint: /opt/data/workspace/wetop-release-evidence/all-release-progress.md, updated after every merge. Background local validation command: python3 /opt/data/workspace/wetop-release-evidence/run-all-candidate-checks.py. Handle: proc_b0db08d82bdd, PID 78560. Logs: all-typecheck.log, all-lint.log, all-unit.log; result JSON: all-check-results.json. Final tested SHA, PR and once-only workflow dispatch ID are recorded in that external checkpoint/PR body as they become available.

This document is not a claim of merge to main, release promotion or deployment. A red or unexecuted full gate blocks release.
