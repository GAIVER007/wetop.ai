# Beauty helper search_path hardening (source preparation only)

CI39167344145 on cd954b5f reports exactly two unpinned helpers in function-search-path.test.ts. This additive follow-up pins the existing branch-hours helper functions without changing bodies, signatures, security mode, table/data/model or booking/money rules. The five prepared Beauty133–137 UP files remain byte-identical to their approved manifest.

UP requires both typed helpers to exist and their `proconfig` to be NULL (the exact canonical137 baseline). It refuses unexpected settings instead of overwriting them. DOWN requires the exact UP configuration, then resets only search_path to restore that canonical baseline. Both are transactional and use a bounded lock timeout.

Validation must run in an isolated GitHub-hosted PostgreSQL fixture: unchanged full function-search-path suite, exact function definitions/configuration before/after UP/DOWN, original five-file rollback witness, and full release-checks. No validation result is claimed by writing this file.

Production application is NOT performed or automatically authorized. This file is additional to, not a weakening/re-pin of, the five-file preparation manifest. The eventual owner cutover package must include it explicitly with132 and133–137 if those are unapplied; require exact candidate approval, fresh backup plus verified restoration, real applied-ledger preflight and a trusted scoped cutover runner. Never apply the old131 single-pending gate or alter approval blindly. Rollback changes helper settings only, not tables or business data; populated Beauty schema rollback retains its separate refusal rules.
