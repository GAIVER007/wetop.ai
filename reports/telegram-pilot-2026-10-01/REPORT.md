# Telegram self-service pilot — 01.10.2026

## Implemented

- Selected agent card and working seller Connections screen: write-only token, tester IDs,
  check, connect/readback, status, last incoming/outgoing, pause responses.
- Nest proxy scopes organization and agent on server, requires seller role/active extension,
  validates inputs, limits requests, strips unknown response fields.
- Seller connection encrypted with existing Fernet secret; Telegram fixed host, no redirects,
  HTTP 200+ok=false is failure; httpx URL token redacted.
- Existing foreign webhook is not overwritten. Incoming secret, private chat and tester allowlist checked.
- Unique agent/update ID and encrypted inbox committed before acknowledgement. Shared engine handles responses.
- Pilot work serialized across processes; pending rows survive restart. Ambiguous send or interrupted
  processing is marked FAILED, visible on connection; no automatic resend that could duplicate a reply.
- Migration 0011 adds two tables; disabled by default. Entry point accepts manually applied 0011,
  but still upgrades automatically only to 0009, never silently through contraction 0010.

## Evidence

- API RED missing service → GREEN 3 tests; working legacy seller scope RED 1 failure → GREEN 4 tests.
  Recorded in tests/runs, logs 08-44-57, 08-50-31, 09-06-10, 09-07-13 UTC.
- Python new module RED; token log regression RED 1 failure → GREEN.
- Python channel/worker/WhatsApp/agent isolation suite: **56 passed**; includes no external network.
- Additional restart regression: **1 failed, 2 passed → 3 passed**; no actual Telegram messages sent.
- PostgreSQL18/pgvector, ephemeral isolated network/tmpfs: 0010→0011→0010→0011 passed,
  final revision 0011, new tables empty. Synthetic DDL test, not a copy of production data.
- Full workspace typecheck encountered 17 errors in pre-existing untracked duplicate `* 2.ts` etc.
  Duplicates preserved; clean tracked-source snapshot + intended new files passes root/API/web types.
- Clean-snapshot production Next build passes after installing isolated locked dependencies.
  Initial symlink build failed due to Turbopack rejecting dependencies outside snapshot; no project
  compiler settings/checks weakened. Final targeted ESLint passes.

## Rollout boundary

Production seller DB is still old 0004. No approval for this turn's production migration received yet.
PMS web/API can display preparation UI, but live Telegram connection requires separately approved staged
0009 expansion, smoke, 0010 contract, 0011 tables and configured webhook host/flag.
User will enter their own bot token on the website. Until then live send/receive is NOT verified.
WhatsApp existing code/regression checked; no Meta credentials or live message exchange configured here.
No Channex production changes, no Telegram reservation source, no Supabase migration in this slice.

## Server maintenance

Root filesystem was full. Pruned unused Docker build cache only: about 32 GB free afterwards.
No database volumes, working containers, rollback images or backups removed. PMS and seller remained healthy.

## Main reconciliation

Remote main advanced to 0930cf5d during work (homepage/authentication changes). Merged without conflicts;
pre-existing untracked report image collisions preserved under `.agent-tmp/pre-main-merge-20261001/`.
After adding the four Telegram endpoints to the explicit access-contract table, merged authentication/
role/Telegram API set passes **26 tests** (09:11:28 UTC run). No role or auth check was disabled.

## Deployment recovery

First rollout of 8c8b125b rolled back successfully to ed8cc7b9: API image import failed EACCES on
bot-panel-client.ts. Cause reproduced in an isolated no-network container: deployment inherited umask077
from private patch-backup preparation, so git checkout produced root-only sources. Server tracked source
modes restored from Git modes (secrets/untracked files untouched); deploy script now explicitly sets022.
Regression test runs real checkout under077 and asserts file readability/directory traversal by image user.
Also fixed brace expansion around APPLIED_SHA next to a Unicode quote (macOS bash3 invalid-ref error path).
Final deploy behavior set: 14/14 pass, with 15s command-line timeout for Git/rollback subprocess tests.
No assertions removed. Existing production database remains unchanged.
