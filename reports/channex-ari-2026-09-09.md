# Channex staging ARI reconciliation — Gate 5 (первая выгрузка)

CONTROL: 2026-09-09, period 2026-09-15 → 2026-09-21, property 60fc6ef0-5cdc-4f53-a2ca-3f477964cb2a

Источник PMS: `GET /chessboard` (free по категории на ночь) и `daily_rates` тарифа ОТА. Источник Channex: `GET /availability`, `GET /restrictions` (staging, прочитано после full sync).
Правила: rate Channex в основных единицах → ×100; stop_sell в Channex = true, когда availability 0 (мы шлём false).

| Category | Date | free PMS | avail Channex | rate PMS (minor) | rate Channex (minor) | stop_sell Channex |
|---|---|---:|---:|---:|---:|---|
| retired-source-5074312 | 2026-09-15 | 1 | 1 | 1540000 | 1540000 | false |
| retired-source-5074312 | 2026-09-16 | 1 | 1 | 1540000 | 1540000 | false |
| retired-source-5074312 | 2026-09-17 | 2 | 2 | 1540000 | 1540000 | false |
| retired-source-5074312 | 2026-09-18 | 0 | 0 | 1540000 | 1540000 | true |
| retired-source-5074312 | 2026-09-19 | 2 | 2 | 1540000 | 1540000 | false |
| retired-source-5074312 | 2026-09-20 | 2 | 2 | 1540000 | 1540000 | false |
| retired-source-5074312 | 2026-09-21 | 3 | 3 | 1540000 | 1540000 | false |
| retired-source-5074686 | 2026-09-15 | 4 | 4 | 1400000 | 1400000 | false |
| retired-source-5074686 | 2026-09-16 | 3 | 3 | 1400000 | 1400000 | false |
| retired-source-5074686 | 2026-09-17 | 6 | 6 | 1400000 | 1400000 | false |
| retired-source-5074686 | 2026-09-18 | 6 | 6 | 1400000 | 1400000 | false |
| retired-source-5074686 | 2026-09-19 | 6 | 6 | 1400000 | 1400000 | false |
| retired-source-5074686 | 2026-09-20 | 7 | 7 | 1400000 | 1400000 | false |
| retired-source-5074686 | 2026-09-21 | 8 | 8 | 1400000 | 1400000 | false |
| retired-source-5074687 | 2026-09-15 | 0 | 0 | 2100000 | 2100000 | true |
| retired-source-5074687 | 2026-09-16 | 0 | 0 | 2100000 | 2100000 | true |
| retired-source-5074687 | 2026-09-17 | 1 | 1 | 2100000 | 2100000 | false |
| retired-source-5074687 | 2026-09-18 | 0 | 0 | 2100000 | 2100000 | true |
| retired-source-5074687 | 2026-09-19 | 2 | 2 | 2100000 | 2100000 | false |
| retired-source-5074687 | 2026-09-20 | 2 | 2 | 2100000 | 2100000 | false |
| retired-source-5074687 | 2026-09-21 | 2 | 2 | 2100000 | 2100000 | false |
| retired-source-5074688 | 2026-09-15 | 23 | 23 | 900000 | 900000 | false |
| retired-source-5074688 | 2026-09-16 | 27 | 27 | 900000 | 900000 | false |
| retired-source-5074688 | 2026-09-17 | 29 | 29 | 900000 | 900000 | false |
| retired-source-5074688 | 2026-09-18 | 27 | 27 | 900000 | 900000 | false |
| retired-source-5074688 | 2026-09-19 | 26 | 26 | 900000 | 900000 | false |
| retired-source-5074688 | 2026-09-20 | 29 | 29 | 900000 | 900000 | false |
| retired-source-5074688 | 2026-09-21 | 27 | 27 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-15 | 28 | 28 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-16 | 32 | 32 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-17 | 35 | 35 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-18 | 32 | 32 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-19 | 34 | 34 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-20 | 35 | 35 | 900000 | 900000 | false |
| retired-source-5074689 | 2026-09-21 | 32 | 32 | 900000 | 900000 | false |

RESULT: OK — расхождение 0 — ячеек 35, расхождений 0
