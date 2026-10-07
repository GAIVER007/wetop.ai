# Verification environment recovery

The private PostgreSQL cluster was initialized as UTF8 on port 56093, but initdb inherited the host timezone Asia/Dubai. This was an omission in local preflight. Existing Prisma timestamp serialization expects UTC. The unchanged finance-operations integration test exposed it: an expected 2031-05-11 01:30 local payment appeared as 2031-05-10 21:30. No finance source was changed.

On the owned cluster only: ALTER SYSTEM SET timezone='UTC', pg_reload_conf, verify SHOW timezone=UTC, reset owned pms_test schema and apply the same 69 migrations/seed. The finance and MV10 real HTTP/DB tests then passed 7/7 on the identical assertions. The first full integration result is retained as failed evidence, not GREEN. Global/shared Supabase and foreign clusters were not accessed.

The first full unit run found one missing route access matrix update, plus resource-sensitive failures: shell tests exceeded their original 5s limits, two HTTP tests reported socket hang up, and the scrypt event loop check exceeded 25ms by 0.509ms. The separate auth regressions passed 85/85. The strict route matrix was extended by exactly the three approved public GET routes, with controller service key checks preserved. No threshold, assertion or skip was weakened. Final full results are in README.md.

Initial dependency restoration errors (tinyglobby and generated Prisma client) were environment errors. They were repaired by restoring private dependencies and generating the unchanged client. The early unit run whose code fingerprint changed is explicitly invalid in the journal and is not counted as evidence. Subsequent stable runs are retained.

An integration launch was refused by the existing test runner while browser regression held its lock. The lock was not removed or bypassed. Integration started after that browser run ended.
