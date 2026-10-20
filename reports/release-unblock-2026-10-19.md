# Release unblock and migration 132-137 package, 19.10.2026

## Problem

PR680 (merged as `12ada816`) added a staged window to `.github/workflows/auto-release.yml` that pinned
`STAGED_RELEASE_SOURCE_SHA=4a7c86b2` and held every other green `main` result.

- `4a7c86b2` is not a descendant of the published release `d54ae3b1`, so the existing fast-forward
  guard would reject it anyway.
- Its full gate `39227355643` failed (UI5 `requests.spec.ts` /today, `GET /hotel/settings` x2).

Net effect: no version of `main` could reach the site.

## Change

Owner instruction 19.10.2026 «давай продолжай» chose option 1: retire the stale hold, prepare 132-137,
apply to production only after a separate explicit owner yes.

- Removed the pin and the STAGED-WINDOW block from `auto-release.yml`. Nothing else changed.
- `tests/unit/staged-release-controls.test.ts`: the window test now asserts the hold is gone and that
  every ordinary guard remains before the single `git push origin "${target}:refs/heads/release"`:
  green `release-checks`, target in `main`, fast-forward from `release`, migration warning, and the
  `workflow_run` success-on-main trigger condition. The prebuild verifier tests are unchanged.
- RED: 1 failed / 27 passed on the current workflow (assertion on `STAGED_RELEASE_SOURCE_SHA`).
- GREEN: 28/28. Full unit `2026-10-19T10-51-42Z-unit-142e`: 6278 passed, 7 skipped. Full lint
  `2026-10-19T10-55-45Z-lint-8d4b`: clean.

`verified-release-image.yml` keeps its own pin to `4a7c86b2`; it is build-only and does not promote.

## What happens after merge

The next green `main` fast-forwards `release`. `release..main` contains migrations 132-137, so the
server refuses to deploy and waits for the owner (ADR-080, unchanged). The site stays on `d54ae3b1`
until the migrations are applied. This change unblocks the pipeline; it does not apply SQL.

## Migration package 132-137

Runbook: `docs/ops/beauty-zapis-release.md` (backup, restore-check, maintenance, `mig deploy`,
validation, empty-only reverse order, recovery). Order: ordinary 132 first, then Beauty 133-137.

SHA-256 of current `main` files (first 16 hex shown; full values from `sha256sum`):

| Migration | migration.sql | down.sql | Manifest |
|---|---|---|---|
| 132_customer_imports | 6d800d529100fda3 | d0989850ccd2280f | ordinary, not in Beauty manifest |
| 133_beauty_appointment_lines | db336544977ff3de | 2612ea440c9503e1 | MATCH |
| 134_beauty_reviews | 58a1c26566b13d6f | 8b920ed7e5f46762 | MATCH |
| 135_beauty_materials | 1ce9a2e0b281ec50 | 86e6e1b6d2af3113 | MATCH |
| 136_beauty_positions | e942079adbfcb561 | a86adfa75e486c59 | MATCH |
| 137_beauty_location_hours | 86c2403418211147 | fe46f634c71baaaf | MATCH |

## Still required before production SQL

1. Separate explicit owner yes for applying 132-137 to production.
2. Green `release-checks` on the exact release SHA.
3. Fresh backup plus `db-restore-check.sh` on an isolated database.
4. The agent has no production DB/Docker access: sudo is limited to `wetop-ops` status/health and the
   fixed no-argument helpers. Application is run by the owner or an owner-approved runner.
