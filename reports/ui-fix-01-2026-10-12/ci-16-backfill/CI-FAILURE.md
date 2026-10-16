# CI 16: Platform P1 backfill test scope

Candidate: bc2defdff7b27aaf9a26784a533a663f2005360d.
Run: https://github.com/GAIVER007/wetop.ai/actions/runs/38405966828

Migration application, rollback and schema validation passed. Integration failed on one assertion:
platform-p1-backfill.test.ts expected 3 locations but counted 5. CI: 1022 passed, 1 failed, 16 skipped.
Browser build and downstream e2e steps were skipped after this failure.

The full local integration run reproduced the same single failure. The bar-restaurant-cash fixture
creates independent FOOD_SERVICE and BEAUTY branches without Property. The backfill assertion
counted those unrelated verticals as Hospitality branches. A database query confirmed 3 Hospitality
locations with 3 properties, plus 1 Food Service and 1 Beauty location without Property.

The fix scopes both cardinality assertions to HOSPITALITY businesses in organizations with Property.
Every existing per-property field and organization-chain assertion remains enabled.

RED: tests/runs/entries/2026-10-13T14-02-30Z-integration-26db.json
(1033 passed, 1 failed, 5 skipped).
Targeted GREEN: tests/runs/entries/2026-10-13T14-04-03Z-integration-7a9c.json (3 passed).
Full GREEN: tests/runs/entries/2026-10-13T14-04-17Z-integration-d409.json
(1034 passed, 5 skipped, no failures).
Lint: tests/runs/entries/2026-10-13T14-04-31Z-lint-e10e.json (passed).

Local first typecheck failed because installed node_modules predated the integrated lockfile:
qrcode-generator 2.0.4 is declared in apps/web/package.json and package-lock.json but was missing
locally. Evidence: tests/runs/entries/2026-10-13T14-05-31Z-typecheck-bac4.json.
Dependencies were restored with npm ci using the unchanged lockfile. Fresh root, API and web typechecks passed: tests/runs/entries/2026-10-13T14-06-48Z-typecheck-a830.json.

All local database checks use isolated localhost PostgreSQL on port 55483 and synthetic data.
No shared dev database, production writes, deployment or main/release merge.
New candidate CI remains required; prior candidate success does not certify the new SHA.
