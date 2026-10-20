# UI-FIX-01 runtime verification

This directory is a bounded local proof harness. It does not read `.env`, migrate PostgreSQL, call external AI or mail, or change product data outside its synthetic run marker.

## Web, Nest API and PostgreSQL

Prerequisites:

- local PostgreSQL already migrated in schema `pms_test`;
- `wetop_app` can log in on the same loopback database, so request work uses the normal RLS runtime role;
- Python 3.13 with the CI-filtered bot dependencies for FastAPI, Alembic, SQLAlchemy, aiosqlite, fakeredis and uvicorn; torch and sentence-transformers are neither required nor loaded;
- ports 4324, 3124 and 8324 are free;
- no other WETOP database or UI run is active.

Run serially from the repository root:

```sh
DATABASE_URL='postgresql://postgres@127.0.0.1:55482/pmslocal' \
DATABASE_APP_URL='postgresql://wetop_app@127.0.0.1:55482/pmslocal?schema=pms_test' \
DATABASE_SCHEMA='pms_test' \
DATABASE_POOL_MAX='2' \
DATABASE_APP_POOL_MAX='2' \
UI_FIX_01_PYTHON='/private/tmp/ui-fix-01-bot-venv/bin/python' \
npx playwright test --config tests/ui-fix-01-runtime/playwright.config.ts
```

The suite starts the real Nest `AppModule`, Next application and a loopback FastAPI support panel. The API keeps `SessionGuard`, `RoleGuard`, `AuthorInterceptor`, business capability checks and the runtime database role. Only mail is replaced by the repository `StubMailSender`. Provider credentials inherited from the shell are removed before `AppModule` compiles. Seller, Channex, site generation and guard jobs are disabled; seller and support URLs point only to the local panel. The harness refuses non-loopback database URLs or a schema other than `pms_test`. `PII_STORAGE=real` is set only after those checks so the synthetic date update can exercise the real path.

The support panel is ephemeral and loopback-only. It uses genuine FastAPI routes and nested local storage in Alembic-migrated SQLite, with fakeredis and the repository deterministic fake hash embedder injected in process. It does not import torch, sentence-transformers, an external embedding provider, or an external Redis server.

Global setup uses the administrative connection only to create and later remove exact synthetic IDs, switch the synthetic organization to `READ_ONLY`, and read back rows. Those operations are setup and observation, not permission proof. The protected `GET /__ui-fix-01/runtime-role` request runs through the normal bearer session, guards, `AuthorInterceptor` and tenant pool, and must return PostgreSQL `current_user=wetop_app` plus the synthetic organization context. All tested product mutations also use bearer authentication. The login response body, token and cookies are never attached or printed.

Covered claims:

- a browser invitation stores the explicit allowed location scope;
- direct HTTP stores an explicit whole-business scope, while a foreign scope and a forbidden `OWNER` assignment are rejected without creating rows;
- Food customer PATCH distinguishes omitted, explicit `null`, a valid new date and an invalid date, with API response and PostgreSQL readback of VIP, first name, last name, phone, email and status invariants;
- Food customer PATCH returns 404 for a synthetic customer in another organization and 403 in `READ_ONLY`; both attempts leave the complete observed customer row unchanged, and teardown restores `ACTIVE`;
- the ordinary customer web form clears the date and reloads the persisted `null`;
- Hospitality creates one `ROOM` and two `BED` units through the real guarded API, then an already open inventory form and guarded writes for reservations, units, inventory, Bar and Channels return readonly denial while DB snapshots remain unchanged;
- `/today` switches through the real branch chooser from Food (`Главная`) to Beauty (`Сегодня`), then Hospitality redirects to `/finance` (`Обзор бизнеса`); `/help` shows each vertical's exact current guide links and omits links from the other verticals, while explicit bearer `/auth/me` requests independently confirm all three location contexts;
- the KB screen creates A, saves B as version 2, publishes B and reloads B through the real Nest to local FastAPI path.

Automatic Playwright trace, video and failure screenshots are off. The suite writes only named full-page screenshots with synthetic content to:

```text
/tmp/ui-fix-01-runtime-screenshots/<run>/
```

For Team, D01 and KB it writes `before` and `after` at 1440x900 and 390x844 in both light and dark themes. Override the parent with `UI_FIX_01_SCREENSHOTS`. The suite uses one worker and independent cases; a failure exits nonzero without treating unrelated cases as passed.

## Local KB panel storage

Run from the repository root with the same lightweight Python 3.13 interpreter:

```sh
UI_FIX_01_PYTHON='/private/tmp/ui-fix-01-bot-venv/bin/python'
"$UI_FIX_01_PYTHON" -m pytest tests/ui-fix-01-runtime/test_support_kb_panel.py -q
```

This direct storage proof uses the actual FastAPI bot panel routes, Alembic-migrated temporary SQLite storage and the checked-in deterministic fake hash embedder. It proves that saved text B becomes stored version 2, is the version published, and is read back as B. The browser suite uses the same bounded local storage shape through `kb-panel-server.py`. These checks do not prove an external embedding model, external AI response, production bot storage, or external publication.
