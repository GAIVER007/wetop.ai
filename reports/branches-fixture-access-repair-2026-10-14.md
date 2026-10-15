# Branches UI fixture access repair, 14.10.2026

Scope: one line in tests/branches-ui/fixture-api.ts. The synthetic /auth/me route used Access(desk), while the production AuthController.me uses Access(self). After CORE security fail-closed enforcement, the fixture denied stale pointers before scope recovery could run. Align only the fixture metadata; production access rules remain unchanged.

RED: release-checks38691820450 job116286943442, three existing stale/cross-organization pointer scenarios failed.
GREEN: 2026-10-15T06-51-13Z-e2e-477b, all three scenarios passed against an owned isolated PostgreSQL database. Assertions and CI timeouts unchanged.
Root/API/web typecheck: 2026-10-15T06-52-24Z-typecheck-1dc6, pass. Lint: 2026-10-15T06-52-47Z-lint-23ce, pass.
Review: fixture /auth/me matches the production decorator; onboarding routes retain desk rights. No new dependency, product change or financial change.

Publication and exact-SHA green gate still pending.
