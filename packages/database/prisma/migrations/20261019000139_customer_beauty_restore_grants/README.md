# Restore ACL companion (source preparation only)

Real RED39167344145: restoring a no-ACL dump followed by the existing pure-grants replay broadens Beauty review privileges, because mixed DDL/ACL migrations are correctly excluded from replay. The earlier026 grants full default CRUD; the later narrowing clauses in132/134/136/137 need this pure-ACL companion, following existing129_employee_portal_grants.

This migration repeats those exact established restrictions. It does not grant new rights, replay schema/data DDL, change RLS, reset material ACL, or edit historical UP files. No outer BEGIN/COMMIT: the restore runner owns atomicity. The deliberate no-op DOWN preserves the already-established pre139 ACL; broadening them on DOWN would be incorrect. The ordinary migration gate must prove exact pre/post schema parity.

Required proof: full ACL equality before/after real restore, refusal without confirmation, synthetic lexically-last pure-grant error after real replay that rolls back both data and ACL, unit selector coverage, full migration and integration gate. Writing this file does not prove those tests pass.

Production application is not performed or automatically authorized. Eventual pinned candidate migration package, verified fresh backup/restore and trusted scoped runner must include this exact file when unapplied. Do not reuse the historical131 single-pending helper approval. Old-backup/version compatibility remains a separate runbook preflight; never apply this companion if required objects are absent.
