# Verification environment recovery

The private PostgreSQL cluster was initialized as UTF8 on port 56093, but initdb inherited the host timezone Asia/Dubai. This was an omission in local preflight. Existing Prisma timestamp serialization expects UTC. The unchanged finance-operations integration test exposed it: an expected 2031-05-11 01:30 local payment appeared as 2031-05-10 21:30. No finance source was changed.

On the owned cluster only: ALTER SYSTEM SET timezone='UTC', pg_reload_conf, verify SHOW timezone=UTC, reset owned pms_test schema and apply the same 69 migrations/seed. The finance and MV10 real HTTP/DB tests then passed 7/7 on the identical assertions. The first full integration result is retained as failed evidence, not GREEN. Global/shared Supabase and foreign clusters were not accessed.

The first full unit run found one missing route access matrix update, plus resource-sensitive failures: shell tests exceeded their original 5s limits, two HTTP tests reported socket hang up, and the scrypt event loop check exceeded 25ms by 0.509ms. The separate auth regressions passed 85/85. The strict route matrix was extended by exactly the three approved public GET routes, with controller service key checks preserved. No threshold, assertion or skip was weakened. Final full results are in README.md.

Initial dependency restoration errors (tinyglobby and generated Prisma client) were environment errors. They were repaired by restoring private dependencies and generating the unchanged client. The early unit run whose code fingerprint changed is explicitly invalid in the journal and is not counted as evidence. Subsequent stable runs are retained.

An integration launch was refused by the existing test runner while browser regression held its lock. The lock was not removed or bypassed. Integration started after that browser run ended.

After fresh-main sync, the full unit run had 3896 passed, 16 failed and 4 conditional skips. Fifteen failures were unchanged shell-test timeouts; the unchanged Guests HTTP case passed on focused retry together with all 16 auto-deploy cases. That retry was interrupted by host sleep: pmset records sleep at 20:36:52 Dubai and full wake at 21:08:50, matching the 32-minute elapsed db-restore fixture case. Its failed output is retained. After wake, the identical db-restore file passed 7/7 in 11.12 seconds with its original assertions and limits. The next full unit run uses one worker and caffeinate, without other heavy checks or weakened thresholds.

The subsequent full unit result was 3911 passed, one unchanged sites-runtime HTTP socket hang-up and four conditional skips. Final full verification uses one worker and one retry for transient failures, retaining every test and its original deadline/assertions. The 32-minute host pause is confirmed by host-sleep.log (actual Sleep timestamp 20:36:50 Dubai).

The new manual-instruction browser checks initially matched two status landmarks (instruction confirmation and existing Telegram connection status). The save itself succeeded. The locator was narrowed to the exact instruction confirmation, retaining and strengthening its text assertion and the subsequent reload/readback check. This test-authoring failure is retained in the journal, not claimed as a product fix.
