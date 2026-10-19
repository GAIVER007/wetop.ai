# History line reader: bounded actual evidence

Created.after and moved.before/after retain allowlisted line snapshots despite equal visit totals. Optional missing legacy components stay unknown, not reconstructed. No raw JSON/customer/private/recipe/lot-cost metadata, unresolved entities or new permission bypass. API/web DTOs mirrored.

Actual recorded runs, codeChangedDuringRun=false:
- `2026-10-19T09-11-41Z-unit-b204`: failed, exit1, counts={"total": 5, "passed": 3, "failed": 2, "skipped": 0, "flaky": 0}; log `tests/runs/logs/2026-10-19T09-11-41Z-unit-b204.log`.
- `2026-10-19T09-12-58Z-unit-a3d4`: passed, exit0, counts={"total": 5, "passed": 5, "failed": 0, "skipped": 0, "flaky": 0}; log `tests/runs/logs/2026-10-19T09-12-58Z-unit-a3d4.log`.
- `2026-10-19T09-13-11Z-typecheck-aa43`: passed, exit0, counts=null; log `tests/runs/logs/2026-10-19T09-13-11Z-typecheck-aa43.log`.
- `2026-10-19T09-14-53Z-lint-c89a`: passed, exit0, counts=null; log `tests/runs/logs/2026-10-19T09-14-53Z-lint-c89a.log`.

Narrow review PASS. Root/API/web types + full lint GREEN. Targeted unit RED2fail3pass→GREEN5/5 is not full unit/integration/browser proof.

This fixes only reader/DTO. Full writer previous/next line values and recipe/DONE provenance remain separate missing implementation. No schema/auth/RLS/financial rule/route changes. No production release or all94Beauty acceptance claimed. Already-lost history cannot be reconstructed from current catalog. CSV683 and money684 release queues remain separate pinned candidates; PR678 schema conditions remain.
