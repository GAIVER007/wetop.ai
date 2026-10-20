# SupplierPaymentForm: source-component browser regressions

Run from the repository root, without a database, Next server, credentials or external APIs:

```sh
CHROMIUM_PATH=/path/to/chrome npm run test:record -- e2e --config tests/supplier-component/playwright.config.ts --workers=1
npm run test:record -- unit apps/web/src/app/bar/actions.test.ts apps/api/src/bar/bar-payment-methods.test.ts --maxWorkers=1
npm run test:record -- typecheck
npm run test:record -- lint
```

Omit `CHROMIUM_PATH` when Playwright browsers are installed normally. No dependencies
were added: esbuild is already installed through tsx. The release-checks fast job runs
this configuration after installing Chromium and checking the site. This PR does not
trigger that workflow; its configured triggers remain unchanged.

The tests bundle the real `SupplierPaymentForm`, `useBarAction` and `BarContextFields`.
Explicit adapters replace only UI wrappers/labels, the domain label function and the
server action. The action records browser FormData and calls a loopback HTTP adapter.
An actual rejected browser fetch exercises uncertain transport failure; a React error
boundary permits an explicit component remount with the same draft re-entered.
Requests outside the test's own loopback origin are blocked.

The 16 scenarios cover same-tick submit deduplication, equivalent amount spellings,
legacy context ordering and key reuse, conflicting legacy keys, get/set/remove storage
failures, stable draft UUID after failed persistence, retry/remount, success cleanup,
a new payment after success, different unresolved amounts, integer-safe identity beyond
Number.MAX_SAFE_INTEGER, unchanged submitted amount text, and invalid amount syntax.

This proves source-component behavior, not Next server-action protocol, server-side
idempotency or real financial posting. Other tabs, downgrade and real data are not
covered. Cleanup failure locks only the mounted form. Reload/remount is not a substitute
for checking whether the payment was recorded; close older forms/tabs on upgrade.

`test:record` records this as a partial e2e run, not full application e2e coverage.
The existing e2e fingerprint watches production source but not this test directory:
rerun explicitly whenever these regressions change, regardless of `test:status`.

The followup is based on origin/main `a6c73813b22c2a2aeb384a3811769919b8260836`.
The original form baseline matched main byte-for-byte. A fresh baseline run with these
tests failed 13/16, with 3 passing (journal `2026-10-17T05-19-17Z-e2e-c0a4`).
Only the form fix and regression harness were carried over, not the previous worktree's
journals. Current followup verification entries/logs are committed under `tests/runs`.
