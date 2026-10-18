# Employee personnel kind — ОТДЕЛЬНЫЙ РЕЛИЗ

Held, NOT production-authorized. One nullable text column on existing Employee; exactly SPECIALIST, OTHER_EMPLOYEE, BOTH or NULL. No default, backfill, new role, RLS policy or grant. Legacy creation stays NULL. Canonical schema and migration guards remain unchanged.

Separate release requires owner approval, backup/restore rehearsal, canonical fixture/RLS/API acceptance, promotion together with canonical Prisma mapping, and the existing migrations-hold release procedure. Apply complete migration.sql using explicit owned schema search_path and ON_ERROR_STOP. Do not use public fallback. Enable PERSONNEL_KIND_ENABLED=1 only after migration and deployment validation; otherwise keep absent/OFF. ON without migration returns unavailable, not successful null data.

Disable feature before rollback. down.sql obtains ACCESS EXCLUSIVE and refuses if any nonnull assignment exists. Rehearse successful down/schema equality only on a fresh never-assigned canonical fixture. Once assignments exist, do not clear them to bypass guard: preserve/export and approve a separate restoration/forward-repair strategy first. No CASCADE. No production SQL was executed.

CI pending: full canonical preapply snapshot, column absence/NULL/default/CHECK assertions, real SessionGuard/AppModule assignment/reload, wetop_app non-owner/non-bypass RLS and tenant GUC, foreign org/business/missing-scope denial, manager/property/readOnly boundaries, stale concurrent microsecond CAS, enum-only audit, assigned down refusal retaining values and never-assigned down equality. See external personnel-backend-slice.md for evidence limits.
