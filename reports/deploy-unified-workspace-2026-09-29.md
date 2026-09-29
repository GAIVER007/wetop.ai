# Production deployment — unified workspace, 29 September 2026

- Application: https://app.wetop.ai
- Deployed commit: `330502c50e25bcca53474ff995c4f6b47a5b4deb` (PR #169 merged).
- Previous checkout: `56b1f5761e4905cdafac501ad33e957b5836f0a5`.
- Host: WETOP VPS, `/root/wetop`; existing Compose project `pms-lux`.
- API and web image: `sha256:7d79658c694fa17e1075bdd9cad69936e0591369b55c42609ba0175537915e05`.
- Next BUILD_ID: `CST85a-ORzLl2fJkhgl5y`.
- GitHub release branch advanced to the deployed commit after public verification.

## Procedure

SSH access restored by owner. Verified checkout, clean tracked files, current containers and delta.
Application delta is CSS/shared page header; no API/database/migration changes from the running version.
Marketing site files in the target commit are not deployed by the app Compose build.

Held `/var/lib/wetop-deploy/lock` during the manual deployment. Saved the previous image as
`pms-lux:rollback-56b1f576`; protected environment/Compose backup at
`/root/backups/wetop-deploy-20260929T154732Z` (contents not logged or committed).
Production Docker/Next build passed. Recreated only api/web with `--no-deps`; tunnel untouched.
No database migrations, guest writes or external channel commands were performed.

## Evidence

- API/web both running and healthy after restart.
- Internal API health: `status=ok`, `database=up`.
- Anonymous inventory request: HTTP 401.
- Public login HTTP 200, real login form rendered.
- Anonymous protected routes send login redirects in streamed HTML; not treated as authenticated checks.
- Three public CSS files match SHA-256 checksums of files in the new container exactly:
  - `3mbnlg4ymdfx-.css`: `8ee6dccf15a41277ce64f4bc83f90d6771695a94b37a34ef9180d0cd8813d406`
  - `3p_mirorbj9dx.css`: `c6a0c7c19228aac69a9757ad8de3b6cdf9ff41d1fd1044151c04acabeb9da2a7`
  - `2y5onsg6_1o6z.css`: `4a0054b76d8c9bf50d95997220bd9ffc9d2c4f92f34404add35a551de7c07b55`
- CUA browser login using existing saved credentials succeeded and opened `/today`.
- Authenticated read-only navigation: Главная, Брони, Номерной фонд, Настройки объекта,
  ИИ-агенты, Шахматка. Expected headings appeared without load-error page.
- No credentials or guest details captured in this report. Public probe JSON saved alongside report.

This is a deployment smoke check, not a claim that every production mutation was exercised.
Prior UI evidence and limitations are recorded in `unified-workspace-2026-09-29.md`.

## Rollback

Under the same deployment lock: checkout the previous commit, tag the preserved rollback image
as `pms-lux:latest`, recreate api/web using both Compose files and `--no-build --no-deps`, then
verify internal health/public login. Restore deploy-state marker to the actual running revision.
No data rollback is needed for this CSS/UI-only deployment. Keep the release pointer coordinated
with the rollback to avoid an unintended redeploy.
