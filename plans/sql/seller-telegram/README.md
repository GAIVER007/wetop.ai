# Telegram pilot migration 0011

01.10.2026. Implementation/test database approved; production NOT approved/applied.

## Prerequisites and rollout

- Seller runtime currently 0004. First follow `../seller-runtime-expand/README.md`: explicit approval,
  dump, 0009, new compatible runtime, smoke and agent-scope reconciliation.
- 0010 contract must be separately approved and validated after that smoke. Never run `upgrade head`
  on the old production revision to enable Telegram. Check its existing migration/rollback tests.
- Keep `TELEGRAM_SELLER_ENABLED=false` until all steps below pass. Support service stays unchanged.
- Capture current image ID and revision, stop seller web/monitor, take `pg_dump -Fc` to private server
  storage with umask 077. Check `pg_restore --list` and checksum. Do not print credentials or records.
- Require current revision exactly 0010. Run new seller image with entrypoint override:
  `alembic upgrade 0011`. This adds only telegram_connections and telegram_inbound_events.
- Validate revision 0011; new tables empty; existing organization/agent/client/conversation/message
  counts unchanged; original agents/keys preserved; unique(agent_id, update_id) and unique(bot_id) exist.
- Restart seller runtime. Configure server-owned HTTPS `TELEGRAM_WEBHOOK_BASE_URL` (seller host),
  existing LLM_KEYS_SECRET, then explicitly enable TELEGRAM_SELLER_ENABLED. Never use support token.
- Public webhook route must reach seller and reject missing secret. Health must expose status only.
- UI: open selected agent, supply own BotFather token and own numeric tester ID, check, connect,
  send a synthetic private message. Verify response in the same bot, event DONE, last sent timestamp,
  and scoped conversation persisted. Unauthorized tester, forged webhook and duplicate update rejected.

## Rollback

- Disable TELEGRAM_SELLER_ENABLED, stop worker/web; preserve a new dump including encrypted channel
  data and pending events. Do not lose these or purge the inbox. Remote webhook remains assigned.
- Prefer rollback application on expanded schema. For DDL rollback only after export and approval:
  current revision must be 0011; `alembic downgrade 0010` removes ONLY the two new Telegram tables.
- Validate revision=0010, old table counts unchanged, restore previous compatible image. Keep pilot off.
- Do not restore an old whole database snapshot over newly arrived messages without reconciliation.

## Delivery limitation

Telegram sendMessage provides no idempotency key. Timeout/crash after send is ambiguous: mark FAILED
with delivery_unconfirmed/processing_interrupted, no blind resend. Worker restart resumes RECEIVED
rows; uncertain PROCESSING rows become visible failures after five minutes. Check dialog before retry.
Pilot accepts only private text and allowlisted IDs. It does not add a Telegram reservation source.

## Test evidence

PostgreSQL18 + pgvector temporary container on isolated internal Docker network, no exposed ports:
0010→0011→0010→0011 completed; revision and both new table counts verified. Temporary database removed.
See `reports/telegram-pilot-2026-10-01/postgres-up-down-up.log`. Production data was not used.
