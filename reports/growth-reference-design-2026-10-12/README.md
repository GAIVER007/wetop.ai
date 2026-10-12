# Growth reference design validation

Approved plan: plans/growth-reference-design-2026-10-12.md.

Marketing shares three module cards and a results/start sidebar across all verticals. Hospitality site links remain hospitality-only. Sales retains live hospitality API behavior; non-hospitality hubs show module availability and existing operational links, without fabricated market or seller metrics.

Recorded regression: 57c8 failed on the old composition. Final unit 471d: 20/20, unchanged code fingerprint. Lint e8dc passed. Typecheck is recorded separately.

SSR preview generated from the actual components at /private/tmp/wetop-growth-preview. Browser creation timed out twice. Opening in Codex was queued. Visual reference fidelity and mobile overflow are not verified. No old screenshots are presented as current proof. No authenticated UI or deployment claim.

Review: shared component has no auth fetch of its own; route guard retained. No schema, permission, external API, money or production data changes. Existing hospitality source data and non-hospitality catalog/customer links are preserved.

## Follow-up validation

Semantic result icons replaced dashed ovals. Local browser screenshot captured after reload. Phone iframe clientWidth and scrollWidth both 390. Screenshots are local SSR previews, not a production deployment claim.

Confirmed release blocker in main: design-rules rejects radial-gradient in restaurant floor canvas. Recorded failing d9ec. Replaced the dotted background with a token-based linear grid without weakening the test.

Final full unit 83ca: 4607 passed, 4 skipped, no failures, one worker. The previous parallel run had HTTP fixture contention. Breakpoints were corrected to the canonical 1279/960/600 scale. Lint 1bfd and typecheck 0841 passed for the icon change; subsequent source edits are CSS only.
