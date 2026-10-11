# Today alignment correction, 2026-10-11

Base: cad5ea82857dd4d6fe25bfcba1c7f5a51073a61c. CI38123707653 UI1 failed at chessboard-mobile.spec.ts267: Today left edge differed from sticky unit-column right edge by124px, expected<=2px. Scroll restoration assertions passed before that failure. Other mandatory jobs passed, aggregate failed.

Local run08-53-48Z-e2e-7498 timed out earlier while loading the reservation. It is not alignment RED evidence. Warm unchanged run08-58-21Z-e2e-3f1d reproduced the same124px failure, with unchanged assertions and deadlines.

Cause: at the end of the week, the scroll container clamps the requested horizontal position because the table has insufficient trailing space. Current Sunday cannot align next to the sticky unit column. Correction adds the measured remaining viewport width as table end margin on Today reset, and calculates the requested scroll using visible header geometry rather than offsetLeft. No dates, availability, reservation, finance, auth or API contracts changed.

GREEN09-00-35Z-e2e-cab0: the identical scenario passed, including both restored positions, <=2px alignment and zero vertical position. A stream-close development-server log remained after the passing test and is retained; this result does not explain prior unrelated503 incidents. Mobile width checks and full CI of the final commit remain required. No main/release/production mutation.

Follow-up retention check: the test now reloads after Today and repeats the <=2px assertion. RED09-04-32Z-e2e-5e4e reached the new assertion with124px, because margin set only during reset disappeared on reload. The final correction reserves measured trailing space when the mobile hook mounts, before saved coordinates restore; reset recalculates it. Cleanup restores the previous inline margin. Existing assertions and deadlines unchanged. Initial mobile checks09-02-38Z-e2e-c8b2 passed3/3 at360/390/430. Final combined four-scenario run remains in progress.

Review: one UI-state hook changed; no API/schema/money/auth behavior. End space is derived from container width and actual sticky/day headers, without a hard-coded day width. Same mount establishes space for restoring saved positions. Test strengthened with reload, not weakened. Mobile-only effect preserves desktop behavior. ESLint of both changed files and git diff --check passed. Production runtime SSH attempt to the documented address timed out; no host verification bypass or production mutation.

Final GREEN09-06-38Z-e2e-5c15:4/4 PASS, all three mobile widths and the strengthened restore/Today/reload scenario. No assertions/deadlines/jobs disabled or weakened. Fixture and Next servers shut down, locks empty. Generated booking screenshots from the width checks were restored to their prior tracked versions; run logs remain. Full CI of the next frozen commit is still required before any release decision.

Final npm run typecheck:web completed with exit0. Own ports56180/56181 have no listeners; locks empty. No production data or external integrations used.
