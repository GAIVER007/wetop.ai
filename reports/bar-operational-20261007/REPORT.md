

## Approved reversal policy, 2026-10-07

The owner approved denying BAR reversal for closed Folios and Folios with any completed payment allocation. The endpoint now requires `refunds` access. Folio locking precedes the sale lock and follows Finance payment/close serialization.

RED: `2026-10-07T12-54-23Z-integration-a9a9` reproduced both closed and partially paid Folio reversals returning 201 instead of 409. GREEN: `2026-10-07T12-55-50Z-integration-4ca7` passed the three selected STAFF/closed/paid cases. Six unrelated tests were filtered out by `-t`; this is not a full suite result and no skip declarations were added.

The dedicated five-case `bar-reversal-policy.test.ts` run did not start: npm failed with `ENOSPC`. The system reported about 153 MiB free. Persistent operation replay, supplier debt compensation, no-restock loss accounting, real SessionGuard acceptance and full final-head CI remain unfinished. No migration, release or production deployment was performed.

Targeted ESLint passed. API typecheck failed because the local generated Prisma client lacks upstream `GenerationRun`; no API GREEN claim is made. Regeneration and final checks remain required after freeing disk space.
