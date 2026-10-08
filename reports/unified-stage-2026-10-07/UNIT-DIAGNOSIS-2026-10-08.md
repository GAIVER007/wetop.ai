# Unit failure diagnosis

Production, release and main untouched. No timeout, threshold, result assertion or required job removed.

RED: 2026-10-08T09-13-09Z-unit-b711, unit-only with two workers: 4066 passed, four failed, four skipped. The previous mixed-project invocation after database teardown is not integration evidence.

HTTP suites: analytics rate-limit and seller quote rate-limit stopped with socket hang up. Their Nest applications were initialized without an explicit listener. Installed Supertest serverAddress starts an ephemeral listener whenever address() is empty; end closes it after each response. A direct 61-request probe recorded 61 listening and 61 close events. The fixture now owns one loopback ephemeral listener from beforeAll to afterAll. No transport retry added. Existing limit60/drop61 and seller429 assertions retained. Collector beforeEach now awaits flush before clearing its fake sink, so a failed previous request cannot leak buffered hits into the next test.

GREEN HTTP: 2026-10-08T09-22-51Z-unit-50b5, analytics15/15 and seller20/20. Auth performance still failed in that run (41.927625ms against unchanged25ms). These are test-fixture lifecycle repairs, not a claim that the historical application503 has been explained.

Registration: source uses queued asynchronous crypto.scrypt; no synchronous password hash found inside registration or fake user create. Host snapshot showed concurrent Chrome renderer183 percent CPU, another renderer50, foreign Next50, file-provider30, and background Node processes. Those processes were not interrupted. A diagnostic single-test run 2026-10-08T09-24-05Z-unit-b1d9 passed the unchanged25ms check with58 tests filtered; this is isolation evidence only, not full-suite success or proof of a repair. Cause remains unconfirmed: scheduling/GC versus application blocking needs stronger attribution if the full run fails. No auth implementation or timing assertion changed.

A complete unit-only run with the HTTP fixture repairs is in progress. The final exact-SHA PostgreSQL16 CI remains required and has not been replaced by a filtered diagnostic run.

Complete run09-24-31Z-8a9e:4051 passed,19 failed,4 skipped. All94 analytics/seller/auth tests passed. The19 remaining failures are unchanged deadlines in auto-deploy, db-restore-prod and guard-run shell suites. Fingerprint unchanged during run. This is a RED local candidate, not full acceptance. No additional rerun or relaxed time limit selected. Submit the exact frozen SHA to the full existing Linux/PostgreSQL16 workflow for environment comparison; a green outcome alone will not establish a root cause for previous timing failures.
