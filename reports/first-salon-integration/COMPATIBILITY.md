# Compatibility only, first salon integration

## Contract-preserving changes

1. `f0f095f03c45bb062639be433e1185fedff1ea58`:
   - Employee portal seed PATCH sends both `expectedRevision` and `expectedProfileRevision` from the same existing GET result.
   - Missing Employee revision has its own negative HTTP400 check. Mass assignment check now supplies legitimate original tokens so a missing token cannot mask forbidden `userId`.
   - New HTTP regression isolates stale Employee token and stale public-profile token, expects409 and verifies winning persisted state/revisions unchanged. No GET refresh before stale writes.
   - Beauty archive GETs employees for its existing synthetic fixture, captures current original `profileRevision`, PATCHes `active:false` with that token; diagnostics allow only bounded known error keys rather than a raw response body.
   - Calendar fixture reads `/beauty/schedule?employee=<same employee>` once per new synthetic employee and PUTs `expectedRevision:weekRevision` alongside its intervals.
2. `b81e2be5965849938ddba44ede3f79a56c81bd5c`: calendar page unit mock exposes the `currentMe` context now required by accepted F02 scope binding. Preserves U1 `requireFeature` mock. Reproduced2 failing tests before correcting mock; bounded unit set11/11 passed.

## Actual form preservation

Focused read-only review found original Employee tokens in common workspace and portal forms, original week tokens in Beauty/portal/Food schedule forms. Conflict rereads feed comparison, not automatic stale-token replacement; explicit acceptance remains required. No product form defect was demonstrated and no extra form rewrite was made. Portal browser full run23/23 passed on f0f095f03 with no code changes during run; final exact-SHA gate remains required.

## No changes to

Backend version requirements, authentication, CSRF, RLS, grants, payroll or cash formulas, migrations, workflow configuration, runtime flags or production state. Calendar product changes are exactly accepted source patches auto-merged on fixed base; PR626/630 guards and shared components are retained. No Homepage V4 or revoked7d7d1c49 import.

## Interrupted evidence

Initial beauty full run was interrupted by gateway, has no completed journal and is NOT PASS. Post-restore full run is recorded independently. No test verdict is inferred from a missing process.
