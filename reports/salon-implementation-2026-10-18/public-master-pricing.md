# Selected-master public pricing: implemented and verified

Resolves existing MASTER > LOCATION > CATALOG prices and inherited duration in the public specialist projection and selected-specialist online slots. FREE=0, RANGE shows actual endpoints, UNFIXED has no invented amount; unresolved final prices do not offer a fixed per-service booking. Existing consent, tenant scope, private-field allowlist and canonical appointment planner remain unchanged. API/web nullable amount cutover must be coordinated. ANY-master behavior is unchanged and not certified fixed. No SQL or model changes, no production changes.

RED: public price/duration and SSR regressions before production edits, then 4 real-DB slot regressions with original 3 scenarios retained. GREEN: 19 unit/SSR and 12 actual restricted-role public/API/DB tests, including selected master FIXED/FREE persistence, replay, unavailable/wrong-origin controls and old booking links. All root/API/web types and full lint completed successfully. Earlier resource-interrupted type run is not a pass. Full release gate remains separate and the previous candidate failed.

## Journal
- `tests/runs/entries/2026-10-19T04-33-10Z-unit-9af4.json`: exit 1
- `tests/runs/entries/2026-10-19T04-33-27Z-unit-f410.json`: exit 1
- `tests/runs/entries/2026-10-19T04-34-37Z-unit-182e.json`: exit 0
- `tests/runs/entries/2026-10-19T04-36-30Z-integration-12a9.json`: exit 1
- `tests/runs/entries/2026-10-19T04-37-19Z-integration-25ab.json`: exit 0
- `tests/runs/entries/2026-10-19T04-38-30Z-unit-673c.json`: exit 0
- `tests/runs/entries/2026-10-19T04-51-02Z-typecheck-ef0b.json`: exit 0
- `tests/runs/entries/2026-10-19T04-52-31Z-lint-d8e3.json`: exit 0

Independent read-only source review: APPROVE, no blocking findings. See public-master-price-source-review.json.
