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
