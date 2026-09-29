# Chat redesign — 2026-09-29

Approved scope: themed compact assistant, useful empty state, multiline composer, attachments, clear errors and responsive layout. Implemented in `apps/ai-seller/src/site/widget.js`; existing signed identity, session, polling and consent contracts preserved. No model, API, database, provider or financial changes.

- Support title and draft-only suggestions; seller mode retains generic wording.
- Light/dark colors, compact header with close action, responsive panel, readable bubbles.
- Enter sends; Shift+Enter inserts a newline; composition input is not submitted; Escape closes and returns focus.
- Sending/uploading disables repeat submissions. Failed requests retain draft and attachment. Files can be removed before sending.
- Messages remain textContent-only.

## Evidence

- RED: `tests/runs/logs/2026-09-29T16-01-32Z-e2e-3273.log` — all 3 UX checks failed against old widget (missing welcome/textarea, white dark-theme panel).
- GREEN: `tests/runs/logs/2026-09-29T16-05-01Z-e2e-15f2.log` — 4/4 Chrome browser scenarios passed, synthetic intercepted requests only.
- Nine existing no-fixture source-contract functions from `apps/ai-seller/tests/test_widget_js.py` passed (including 320-line budget, no HTML injection/eval/secrets, signed polling and consent).
- `node --check` and `git diff --check` passed.
- Visual inspection: `chat-redesign-2026-09-29/{dark,light,mobile}.png`, rendered using actual platform tokens and mobile positioning CSS.

## Deployment plan

Assistant is a separate service from app/web. Preserve its running image and host widget file; create a new image layer containing only the verified widget file over the exact running assistant image. No other runtime files or migration files change. Confirm current Alembic revision equals its heads before restart. Recreate only assistant app, preserve monitor/database/Redis and all volumes. Verify public health and script SHA against repository. Rollback: restore prior widget and image tag and recreate assistant app without build.

No paid AI messages or real guest data were used in testing. Full Python/backend suite is outside this static-widget change; server message handling is unchanged.

## Additional findings and verification

- Original failed-send loss independently reproduced: `2026-09-29T16-09-06Z-e2e-33f6.log` (expected synthetic draft, received empty string). Current widget: 5/5 PASS in `2026-09-29T16-09-41Z-e2e-fa58.log`.
- Public unversioned script remained a Cloudflare HIT with old SHA after assistant deployment; versioned URL returned exact new SHA. Added explicit script version to platform loader (15/15 unit tests, RED `2026-09-29T16-10-24Z-unit-460c.log`, GREEN `2026-09-29T16-10-43Z-unit-3921.log`).
- Existing integration expectations on login were stale after public-shell separation. Updated test to require no widget on public entry; separately reproduced old signed widget surviving soft logout. Added public-entry lifecycle reset; no auth or identity contract change.
- Logout regression RED: `2026-09-29T16-14-32Z-e2e-dc26.log` — old `.pmsw` remained after logout. GREEN: `2026-09-29T16-15-28Z-e2e-3c3d.log` — 4/4 platform integration scenarios passed, including no widget on public login and signed session replacement.
- Assistant runtime updated at 2026-09-29T16:08:49Z; image `sha256:0f66e994fa44ec54fa9f07abfddee77b3891dea81e1a6d08d671e4610cb455ce`. Versioned public script matches repository SHA256 `246b1bbba2b529fbf3a40bd2a9b46619e17ca45cc599c4b5af47a42f26536b8d`; public health `{status:ok}`. Existing DB revision was already at head (0006); no migration files changed.
