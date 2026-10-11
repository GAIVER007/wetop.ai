# Release preflight, 2026-10-11

Frozen candidate: cad5ea82857dd4d6fe25bfcba1c7f5a51073a61c. Owned checkout clean; test locks empty. No production or release mutations performed.

Exact CI: https://github.com/GAIVER007/wetop.ai/actions/runs/38123707653. During this preflight, fast checks, bot, real-session BAR, food, beauty and branches passed. PostgreSQL16 and UI1/2/3 still running. This is not a completed green release gate.

GitHub compare of candidate to current main: diverged, main ahead508 and behind9, merge base5073ac2a1e591b60b8f46f6609778b84ceacad5c. Current main includes substantial later changes. Do not integrate them silently or claim candidate CI covers a future merge. A rebased or merged candidate needs an explicit scope review and its own complete CI.

Domain read-only observations: app.wetop.ai/login HTTP200. Browser initially displayed loading, then reached wetop.ai login dialog. No authenticated session available for operational acceptance. api.wetop.ai/health HTTP404; this route cannot serve as evidence of API health. Production SHA and migration ledger remain unknown. Existing SSH alias was already established to point to a server without WETOP.

Required before domain release acceptance: establish authoritative runtime access, read deployed SHA and migration history, reconcile against candidate, check fresh backup and migration scope. Owner performs main merge under latest AGENTS section18; release advances automatically only after its gate. Migration application is not automatic. Never force release backward to this frozen candidate.

A4b archive-selection policy remains pending owner choice. Original unexplained503 remains an open diagnostic limitation. OTA, eQonaq and real payments are not activated by this preflight.

## Completed CI follow-up

Run38123707653 finished with failure. Fast, bot, PostgreSQL16 migration/integration/e2e/full master/guarded BAR, real-session BAR, food/beauty/branches and UI2/UI3 passed. UI1 failed at chessboard-mobile.spec.ts267: Today alignment expected<=2px, actual124px. The two previously repaired scenarios passed. This failure occurs after scroll restoration assertions passed; do not describe it as failure of restoration.

Local diagnostic run2026-10-11T08-53-48Z-e2e-7498 failed earlier while navigating to reservation, exceeding existing45s deadline. It does not reproduce the CI alignment failure and is not RED evidence for a fix. No timeout or assertion altered, no implementation changed. Root cause remains pending. Production remains untouched.
