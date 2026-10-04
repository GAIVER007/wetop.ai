# Channex multi-property acceptance, 04.10.2026

Approved: one WETOP service account, explicit mapping per branch, staff scoped to their branch;
nullable country/city/property type metadata. Production metadata migration approved separately
04.10.2026. No production OTA ARI authorization or activation is included.

Implementation:
- Provider IDs resolve to exactly one local Property. Conflicts and unknown webhook targets fail closed.
- Feed, retries, scheduled synchronization and outbox run in verified asynchronous property scope.
- Webhook health and registration caches are per property. Global incidents remain restricted.
- Shared outbox endpoint throttling keeps fair branch priority; busy first branch cannot starve others.
- Setup requires actual location metadata and an explicitly selected priced tariff.
- Metadata survives save and browser reload; shared styled selects meet dark-mode contrast checks.

Evidence:
- Targeted suite: 30 files, 217 tests passed; final channel suite after outbox fix: 27 files, 205 tests passed.
- Regression tests were red before fixes for webhook cache, global incident access and outbox starvation.
- Separate local PostgreSQL: branch isolation, integration scope and channel journal, 3 files/7 tests passed.
  Migration down/up validated inside a rolled-back transaction (0 then 3 metadata columns).
- Browser: property settings, compact channels and reconciliation, 12 tests passed (1.1 min).
  Metadata save/reload test was red before select remount fix, then passed alone and in full UI slice.
- Root/API/web typecheck, lint and production Next build passed.
- Broad apps/packages run: 2721 tests passed; two pre-existing timing thresholds failed under parallel load,
  then both suites passed isolated (56 tests). Full root run also hit macOS bash3 Unicode parsing and
  shell-test timing failures; no claim that the entire local root suite passed.
- Server read-only Channex check: staging, configured key, GET /properties 200 (1 row),
  GET /webhooks 200 (1 row). No secrets or provider payloads exported.
- Fresh production backup: /root/backups/wetop-20261004T104226Z.dump,
  348 KiB, 70 tables with data; backup script validation completed.

Deployment remains gated by exact-candidate release-checks and migration validation. Live OTA booking
receipt cannot be certified before Channex approval and official channel connection.

Production metadata migration applied 04.10.2026: 3 columns, one known-property backfill,
other property metadata remains NULL. Existing property row count (2) and digest unchanged.
Only approved 041 was applied from a migration snapshot excluding the five unrelated pending migrations.
Initial release-checks was cancelled by @GAIVER007; owner approved rerun.

Final local verification after integration fixture correction:
- All integration tests: 79 files passed / 6 skipped, 305 tests passed / 9 skipped (125.52 s).
- UI slice: 13 passed, including laptop layout and metadata save/reload.
- CI candidate 04d57380: 3247 unit tests and 50 site tests passed; full migration rollback/schema
  comparison passed. Integration found an obsolete installation-env fixture; it now creates and
  cleans an explicit property mapping, preserving all database-role assertions (6/6 pass).
- Laptop layout regression was red before assigning metadata/legal panels to the right-hand grid.
- Approved production 046-050 applied after fresh backup wetop-20261004T105313Z.dump.
  Old-data digests for properties, memberships, reservations, reservation_items, folios, payments
  and guests unchanged. Four new tables, four tenant policies, four application grants and two
  membership columns verified. Prisma reports schema up to date.
- Live staging mapping exists, exactly one active webhook, callback and header secret match.
  Empty authenticated callback request using WETOP-Integration-Check/1.0 returns expected HTTP 400.
  Python's default User-Agent received Cloudflare 403; the ordinary service request reaches API.
