# Held rollback: independent security review

Scope: held 114–118 only; no promotion, commit, production helper, shared DB or deployment.

## Findings and fixes
- Existing source + owned-table ACCESS EXCLUSIVE locks precede retained-data checks and are held through teardown. Confirmed via actual pg_locks during each down, not only SQL string matching.
- Fixed unqualified teardown falling through caller search_path into public. Pin exact current schema, pg_catalog and explicitly last pg_temp (otherwise PostgreSQL implicitly prioritizes temp relations). Target schema must be explicitly chosen by an authenticated operator; schema owners remain trusted.
- Fixed inherited REPEATABLE READ snapshot risk: a snapshot acquired before source-lock waiting could miss newly committed history. Standalone down now explicitly sets READ COMMITTED before its first SELECT. Caller must not wrap down in an already-active transaction; PostgreSQL then refuses isolation change rather than silently proceeding.
- Every owned-table guard uses unconditional EXISTS, not active-status filtering; no CASCADE; missing required relations and newer held releases refuse.

## Evidence and limits
- tests/tools/held-rollback-rehearsal.mjs: actual six apply SQL files, 18/18 retained tables independently seeded, including all three opening tables; checks exact table refusal + unchanged row; nonnull snapshot with zero documents; four wrong-order refusals; five empty downs; declared source/owned locks inspected in PostgreSQL.
- reports/held-rollback-rehearsal-security.log is the real local execution output. All rehearsal DDL/DML rolled back.
- This rehearsal strips BEGIN/COMMIT/isolation statements solely to nest in one READ COMMITTED transaction. It does NOT exercise standalone psql transaction boundaries, two-connection race contention, deadlock behavior, or inherited-isolation switching end-to-end. Static RED→GREEN tests cover these isolation/path requirements.
- Metadata-only source clones omit original source FK and triggers; retained fixtures deliberately disable constraints in savepoints. This tests conservative ANY-row refusal, not valid production business fixtures, full baseline migration compatibility, backup/restore or runtime RLS. No production data read.
- tests/tools/held-release-manifest.mjs --dry-run is OFFLINE ONLY (no execute mode). Verifies existing psql runner lists exactly six files in order; reports/held-release-manifest.json records SHA-256 of runner, six applies, five reverse downs. Regenerate after any SQL change.
- Required release gates still include full baseline/FK/old-hook rehearsal, backup plus actual restore validation, concurrent writer behavior, runtime-role RLS and owner approval of exact immutable artifact.

Review frozen at final targeted test run; broader app/gate tests were intentionally not run.
