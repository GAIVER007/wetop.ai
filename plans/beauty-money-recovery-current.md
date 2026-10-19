# Beauty payment/refund recovery, approved full-flow continuation

## Scope

Continue stage4 of `plans/beauty-full-flow-completion-current.md`, not a new financial rule or schema change. Existing backend idempotency is reused. Parent remains sole writer in the same tree. Current published baseline is ad8e85da6528c51215a0628690031598868dc246; its separate exact CI39207742150 must not be presented as coverage of this new working diff. Production remains unchanged.

## Implemented candidate

- One operation key per intentional pay/refund, not per click. Freeze amount/method/trimmed reason in mounted memory before dispatch. Synchronous state transition prevents same-tick duplicate clicks.
- A post-dispatch error, including HTTP4xx, can follow a committed transaction. Treat as unknown, not proof of failure. Identical explicit retry retains the original key; no automatic retry.
- Store only organization/business/location/appointment identifiers and an opaque operation ID in sessionStorage. No form payload, customer details, refund reason or reason fingerprint persisted.
- A surviving marker on remount/reload blocks new money commands and points to history/cashbox reconciliation. It must not replay newly entered inputs or silently expire. This deliberately does not invent an unsafe clear-and-resend action. Scope/appointment changes key the actual body; late responses settle the old operation without closing the next card.
- The server action checks the original scope before any mutation call. Existing API authorization remains authoritative. Only a local preflight rejection proves zero mutation calls. Backend response must include the matching appointment to confirm success. Revalidation failure after confirmation is not a failed payment.

## Evidence already produced

- d7ab initial missing-helper RED, not behavioral proof.
- 7aad:9/10 helper checks passed, one fixture typo changed a JSON key rather than a location value; fixture corrected without loosening the requirement.
- c91e actual existing action behavior:18 failed,12 passed. Scope preflight/unknown response/missing confirmation/cache failure regressions.
- a387 actual card handlers:4 expected failures; actions20 already GREEN. Hook harness is explicitly not browser proof.
- 1fef:39/39 targeted unit (helper10, actions20, actual card handlers4, existing no-show5).
- 08e7 root/API/web types exit0;3b3b full lint exit0. New subsequent test files still need final types/lint.
- bb93 real Chromium component10/10 on390/1440. Uses explicit HTTP/action/UI adapters, not Next/API/DB or visual acceptance. Forwards simulated command, aborts response, verifies identical retry and one simulated ledger entry. Also remount/reload/storage/scope-switch cases.
- 44a5 existing actual DB integration6/6 on independently verified own loopback55983/pmslocal/pms_test. Partial pay/refund replay, exact actual cash entries, balance/status/immutability limits unchanged.
- Independent READ-ONLY review completed06:22:21, no source-level blockers. Reviewer correctly noted misleading test title and limits of mocked React hooks. Real Chromium covers keyed lifecycle; actual Next/API/DB proof launched separately, not yet declared passed.

## In progress

Real full chain `tests/beauty-ui/money-recovery-real.spec.ts` completed: **6838,4/4,0skips,48seconds**. Actual Next action → actual Beauty guards/controllers/services → own synthetic PostgreSQL. Action really committed, browser response deliberately aborted, identical retry compared actual immutable cash-operation IDs/amounts/reason, followed by reload. Four cases pay/refund×390dark/1440light. Dedicated API26897/web26898 exited with the recorded runner, source unchanged. No full-suite/full-product/production proof claimed.

Reviewer-noted misleading hook-test title corrected to late **confirmed** completion suppression; the other existing test independently proves unresolved remount blocking. Component-browser scope test title now states its actual original-marker assertion, not an unexercised second-marker scenario.

## Remaining gates for this slice

Full unit f4e3 **6320passed,0failed,7existing skips**, unchanged source. The combined foreground tool hit its420-second ceiling after unit had completed and interrupted only types8331; no descendants remained except unrelated read-only LSP. Re-ran only the interrupted types stage:9f30 root/API/web GREEN; final full lint1984 GREEN. Exact14 journal entries and10 source hashes are in `reports/salon-implementation-2026-10-18/money-recovery-evidence/matrix.json`; independent review is copied beside it.

Current old-candidate CI39207742150 is NOT GREEN: general integration1634passed/82skipped, then dedicated portal integration41passed/2failed (`employee-portal-schedule-conflicts.test.ts`, returned IDs differ from expected appointment IDs). Exact job117916436581 log preserved externally. This is separate from the new money slice. Scoped read-only root-cause guidance dispatched; no broad audit, no production application. Commit/push this reviewed money slice atomically before repairing that independent blocker. No new production migration or financial/authentication model. No invented global exactly-once claim: protection is for current tab/session; opaque-only persistence cannot reconstruct a refund reason after remount.
