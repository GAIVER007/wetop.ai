# Portal schedule conflict fixture: exact CI blocker

This is a **test-only correction**, not a new product capability. No production query, API shape, schema, permissions or financial rules changed.

Exact old candidate ad8e85da6 / CI39207742150 / job117916436581 passed the ordinary integration stage1634 with82 skips, then failed two of43 dedicated portal checks. Expected IDs were appointment envelopes, but the canonical service reader intentionally returns individual appointment-line IDs. It must remain line-based to preserve each master's own service/time and unique React keys.

## Reproduction and repair

- Owned cluster at approved loopback55603, exact data-directory and zero-client proof before moving the same existing synthetic cluster from55983. No fixture guard bypass/new database/copy.
- RED1485 reproduced the exact two failures on the unchanged test.
- Envelope own/branch/other IDs remain intact, especially cashbox appointment FK.
- Expected line IDs are independently queried by parent FK and asserted against exactly one canonical line, position0, employee, service, starts/ends, and a primary key distinct from the parent. No CI UUID literals or IDs copied from the warning response.
- Ordered exact warning equality retained. Negative other-master check now uses the actual other line ID, not a vacuous unmatched envelope ID. Existing revision, absence/Honolulu timezone, cancellation exclusion, privacy, cross-tenant denial, clearing, bounded500/501 and public no-store assertions retained.
- No-mutation snapshot strengthened to include canonical appointment lines as well as appointments and cash entries.

## Actual proofs

-19e1:31/31, the corrected portal4 plus unchanged real multi-line27, including second-master spans, price, materials/FIFO and one-time DONE. Not31 new capabilities.
-78cb:exact previously failing seven-file portal stage43/43.
-cf9f:root/API/web types GREEN.
-0a3b:full lint GREEN.
-6320 full unit f4e3 remains valid for production/unit-selected source, unchanged by this integration-only test correction.
-Independent READ-ONLY review approved, no findings, copied beside this report. Reviewer did not execute the tests.

## Release is still blocked

Old CI39207742150 ended FAILURE. Besides the now-locally-repaired portal stage, its Beauty UI matrix job117916436568 was cancelled after108 tests started, without a final result. The final UI aggregator failure117925409524 follows that cancellation; the five generic UI shards, food UI, portal UI, branches, authentication and real onboarding were successful. Cancellation is NOT a pass and is not being called a demonstrated product assertion failure. Need actual complete Beauty UI result on the next candidate, with granular diagnostics, not relaxed timeouts/skips.

No new full CI dispatched in this report. Keep PR678 DRAFT. Production and all94 requirements are not declared complete.
