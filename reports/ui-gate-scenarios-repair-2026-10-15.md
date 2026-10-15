# Current UI scenarios, 15.10.2026

Only tests and the recorded owner question change. Product design, financial rules, access rules, API and models remain unchanged.

- Service/employee dialogs now persist selection in URL. Tests close them and await both closure and canonical URL before reloading, then assert persisted rows and continue the existing appointment lifecycle.
- Absence is a tab, employee cards are listitems. The late-response isolation assertion remains.
- Beauty onboarding v2 starts with welcome/profile, blocks completion until four actual readiness checks pass, shows completion confirmation and an explicit Today link. Existing API seed supplies services/master/skills/hours after the profile is saved. Re-entry uses entry=1.
- Connections: full API outage is tested in the protected-screen loop; the existing unknown-health assertion injects only the exact Channex connection failure so auth remains available.

RED: release-checks38691820450, Beauty job116286943392 and UI3 job116286943405. GREEN: 2026-10-15T07-04-29Z-e2e-8c8e, four Beauty scenarios; 2026-10-15T07-06-54Z-e2e-511a, workspace outage scenario. Root/API/web types and lint passed (07-08-00Z-typecheck-7a1d, 07-08-16Z-lint-6c81). CI fast suite on ancestor8715c74b passed; no unit/product source changed here. No published timeout or skip changed.

Review: user-action and persistence checks retained, new readiness restriction checked, late-response boundary unchanged. No blocking findings in test-only diff.

Release remains blocked by DB contract conflicts described in PR538 and QUESTIONS.md, awaiting owner decision, plus cleanup interference covered by PR540. Production still not claimed updated. Backup and migrations105/106 are authorized only after exact-SHA green gate.
