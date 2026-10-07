# MV10: Vertical AI tools

The owner approved the MV10 plan and the narrow backend unblock contract. Implementation started from main `b6db018699fa806060d3e74f8d257ec57a9ff8c2`, then rebased without conflicts onto MKT7 `89f4e5f726eff42d18e3d1a2f107dbb7b450ce6e` and MKT8 `791adad02a5955102f32ffa9c6533a29bc4f3757`. The MV10 diff against its final upstream base adds no schema, migrations, dependencies, financial rules or production deployment.

## Delivered behavior

An active seller resolves its Agent → Location → Business chain, organization status and AI_SELLER access before selecting tools. Each turn owns its registry. Each execution revalidates the binding; changed, unavailable or foreign scope fails closed. Support keeps its separate tools; instruction generation with use_tools=false does not resolve seller tools.

Hospitality retains the existing availability, price and booking handlers. Beauty exposes only enabled active services, canonical location overrides, duration and decimal integer minor-unit price strings. Food exposes only active service periods, local times and the canonical Sunday=0 weekday mapping. Beauty/Food have no Hotel tools, operational customer data, financial reports, mutations or availability promises.

Three GET routes accept only agent UUID and the existing seller quote key: /bot/agent-context, /bot/beauty-services, /bot/food-service-periods. Controllers enforce the key even with AUTH_REQUIRED=0. Owner UI receives the authoritative business vertical and shows corresponding capabilities and instruction guidance.

Beauty/Food instructions are edited manually in the shared editor. The existing Hotel-only instruction generator is visibly unavailable for those directions. Saving and reloading the exact instruction are tested against the real API/DB. The server-selected turn message replaces the legacy Hotel subject; unavailable context has no tools and an explicit unavailability message. Hotel generation/rendering and support are preserved. No generation backend contract was extended.

## Evidence before fresh-main sync

| Check | Result | Evidence |
| --- | --- | --- |
| Python full suite, final source | 1773 passed | python-final-full-green.log |
| Focused route/API unit | 22 passed | tests/runs/logs/2026-10-07T16-07-50Z-unit-b12a.log |
| Finance regression + MV10 real API/DB | 7 passed | tests/runs/logs/2026-10-07T16-05-49Z-integration-3e56.log |
| Full integration | 869 passed, 5 existing conditional skips | tests/runs/logs/2026-10-07T16-09-00Z-integration-bfad.log |
| Vertical UI + accessibility | 12 passed, 12 screenshots | tests/runs/logs/2026-10-07T16-14-59Z-e2e-d196.log; screenshots/ |
| Hospitality UI regression | 25 passed initially; all 4 failed cases passed on retry | tests/runs/logs/2026-10-07T15-33-40Z-e2e-a8e7.log; tests/runs/logs/2026-10-07T16-07-49Z-e2e-e5df.log |
| Actual Python → Nest → PostgreSQL readback | GREEN | runtime-readback.log; executable runtime-server.ts/runtime-client.py |
| Typecheck root/API/Web and lint | GREEN | typecheck.log; lint.log |
| Local production Web build | GREEN | web-build.log |
| Migration application/drift/down | 69 migrations GREEN | migrations.log |

The five Wizard integration cases require the repository's dedicated localhost:55432 fixture; they are unchanged conditional skips on the isolated port 56093. No new skip or weaker assertion was introduced. Paid LLM and production behavior are not claimed.

## Isolation and reproduction

Own clone: /Users/urijzapojnov/wetop-mv10-20261007. Own PostgreSQL UTF8/UTC: /Users/urijzapojnov/wetop-mv10-runtime-20261007/pgdata, port 56093, database pmslocal, test schema pms_test. Browser ports 56094/56095, separate Hospitality regression ports 56103/56104. Shared Supabase, foreign checkouts and processes were not used.

Run npm commands with PATH containing /usr/local/bin, LC_ALL=C and npm_config_offline=true. DB checks additionally use DATABASE_URL=postgresql://postgres@127.0.0.1:56093/pmslocal, DATABASE_POOL_MAX=2, TEST_DATA=seed and PostgreSQL 16 binaries in PATH. Commands:

```text
npm run test:record -- unit --pool=forks --maxWorkers=1
npm run test:record -- integration --pool=forks --maxWorkers=1
npm run test:record -- e2e --config tests/branches-ui/playwright.config.ts --workers=1 tests/branches-ui/vertical-ai.spec.ts
npm run typecheck
npm run typecheck:api
npm run typecheck:web
npm run lint
MIGRATION_CHECK_URL=postgresql://postgres@127.0.0.1:56093/postgres bash scripts/ops/check-migrations.sh
MV10_PYTHON=/Users/urijzapojnov/wetop-mv10-runtime-20261007/bot-venv/bin/python npx tsx --tsconfig apps/api/tsconfig.json reports/mv10-20261007/runtime-server.ts
```

Python suite: run the private bot-venv Python in apps/ai-seller with `-m pytest -q -p no:cacheprovider`. Browser runs additionally set BRANCHES_UI_API_PORT=56094 and BRANCHES_UI_WEB_PORT=56095.

## Red evidence and recovery

New module, per-turn LLM factory, server vertical DTO, Beauty copy, bound-stub fallback, unknown provider mode and Food weekday semantics each have retained RED evidence followed by GREEN. See the raw logs and tests/runs journal. An early run with a changed code fingerprint is invalid and not counted. Environment recovery, the original UTC omission and resource-sensitive unchanged test failures are documented in environment-recovery.md. Log trailing whitespace is normalized only for git diff --check; result content is retained.

## Fresh-main verification

Base: `89f4e5f726eff42d18e3d1a2f107dbb7b450ce6e`. Upstream changed Marketing and added two migrations. MV10 was rebased without conflicts; its approved scope did not change. The generated private Prisma client was refreshed and the two upstream migrations were applied only in the private pms_test schema.

| Check | Result | Evidence |
| --- | --- | --- |
| Full integration | 893 passed, 5 unchanged conditional skips | tests/runs/logs/2026-10-07T16-21-51Z-integration-3dfd.log |
| Actual Python → Nest → PostgreSQL readback | GREEN | runtime-readback-fresh-main.log |
| Typecheck root/API/Web | GREEN | typecheck-fresh-main.log |
| Lint | GREEN | lint-fresh-main.log |
| Vertical UI, main-region accessibility, scope denial | 12 passed, 12 screenshots | tests/runs/logs/2026-10-07T16-30-16Z-e2e-aeb8.log; screenshots/ |

The tables above preserve earlier checkpoints. Final delivery evidence supersedes them below. This milestone stops at an open PR: no merge, production/release or MV11.

## Final delivery on MKT8 main

Base: `791adad02a5955102f32ffa9c6533a29bc4f3757`. The private generated Prisma client and upstream runtime dependencies were refreshed. The private schema was rebuilt from all 73 migrations and synthetic seed only. No foreign DB/process/checkout was modified.

| Check | Result | Evidence |
| --- | --- | --- |
| Full Python | 1776 passed, existing 1202 SQLAlchemy warnings | python-delivery-utf8-full.log |
| Focused Python binding/dispatch/prompt/concurrency | 19 passed | vertical-role-green.log |
| Full integration, including MV10 and upstream MKT8 | 909 passed, 5 unchanged conditional skips | tests/runs/logs/2026-10-07T17-51-24Z-integration-b3a7.log |
| Real UI, main-region axe, keyboard/mobile, scope denial, save/reload and cleanup | 12 passed, 12 screenshots | tests/runs/logs/2026-10-07T18-08-24Z-e2e-d421.log; screenshots/ |
| All migrations, drift and every down.sql | 73 GREEN | migrations-delivery.log |
| Git integrity after partial-clone metadata repair | GREEN | git-fsck-repaired.log |

| Full unit | 3996 passed, 4 unchanged conditional skips; one transient retry permitted | tests/runs/logs/2026-10-07T17-54-07Z-unit-6a54.log |
| Actual Python → Nest → PostgreSQL readback | GREEN | runtime-readback-delivery.log |
| Web production build | GREEN | web-build-delivery.log |
| Typecheck root/API/Web | GREEN | typecheck-delivery.log |
| Lint | GREEN | lint-delivery.log |

Fresh origin/main was verified unchanged at the tested base before delivery. Final browser captures reset scroll to zero and confirm owned fixture removal from the database. Delivery is an open PR, with no merge or production changes. Python uses LC_ALL=en_US.UTF-8 because Alembic explicitly reads its ini file with locale encoding. JavaScript/shell checks use LC_ALL=C. Unit full verification permits one transient retry while retaining all original assertions/deadlines and conditional skips.
