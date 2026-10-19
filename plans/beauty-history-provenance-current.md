# Beauty history provenance: implementation slice

Approved requirement A10/M4 and current owner instruction cover reconstructable history, no new model/financial/provider decision. Existing AuditLog before/after JSON only, no Prisma/migration changes.

1. RED: exercise public BeautyAppointmentHistoryService with moved before/after two-line snapshots whose totals/first line remain equal but second master/duration/discount changes. Exact output allowlist and business/organization/appointment scope assertions. Retain created legacy and absent components as unknown, strip private/unresolved/malformed fields.
2. Fix sanitizeSnapshot + optional item interface fields to retain created.after and moved.before/after safe line snapshots. Money components nonnegative integer strings, currency3uppercaseletters, percentnullorinteger0..100. No raw JSON spread, recipe/cost exposure, new name-resolution bypass or altered permissions/querylimits.
3. Mirror additive optional web DTO fields, no UI display claims. RED→GREEN recorded unit, source review and types/lint.
4. Then writer integration RED on owned local synthetic PG: create fullcomponents, movebefore/after fromstoredpriorlines includingequalaggregateedits. Preserve optimistic/paid/rate/free/timezone/transaction guards. Recipe before/after+DONE exactrevision snapshot separately with proper service locking, real FIFO unchanged.
5. Do not backfill lost past JSON from current catalog. Reader does not by itself prove writer provenance, historical labels or production acceptance. Current writer depends on133/135 prepared tables; no independent livewriter release claim before schemaconditions. Other CSV/money releasequeue remainsimmutable and independent.

Writer/locks checked: no app/package/script dirty sources or live local test locks at start. Parent sole writer, cloud CI uses pinned priorcommit; source freeze for each localtest. GBrain blast/callers attempted, not_built/not_found; actual source references found at appointment-history.ts sanitize caller lines225/226. No prod/shared DB/auth sessions used.
