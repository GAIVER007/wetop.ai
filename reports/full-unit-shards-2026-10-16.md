# Полный unit-набор тремя последовательными shard

Parent проверил реальные записи после timeout исполнителя. Все три запуска завершились до timeout; timeout произошёл при подготовке отчёта. Код между частями не менялся.

Команда для N=1,2,3: `NODE_OPTIONS=--max-old-space-size=1536 DATABASE_POOL_MAX=1 TEST_RECORD_PRESERVE_JSON=1 npm run test:record -- unit --maxWorkers=1 --shard=N/3`.

- `2026-10-16T12-02-28Z-unit-e803`: shard1/3, 1661 passed, 6 skipped.
- `2026-10-16T12-05-11Z-unit-f6b3`: shard2/3, 1723 passed, 0 skipped.
- `2026-10-16T12-08-18Z-unit-aaa6`: shard3/3, 1796 passed, 1 skipped.

Python проверил уникальный полный набор shard-аргументов, status passed и codeChangedDuringRun=false каждой записи, единственный общий fingerprint `0b1fdf7503716022c40a85e2d4e497539069951d81c448d25432194430e720f8`.

Итого: **5187 tests, 5180 passed, 0 failed, 7 skipped, 0 flaky**. Это полный unit-набор, разнесённый штатным Vitest sharding, не полный release gate. Пропуски не считаются успешными тестами. Build/integration/E2E/UI/production acceptance этим отчётом не подтверждаются.
