# Цены и ограничения: PMS против Channex (2026-09-13 → 2026-12-01)

CONTROL DATE: 2026-09-13
PERIOD: 2026-09-13 → 2026-12-01 (80 дн.)

Снято 2026-09-13 11:03 UTC. Объект Channex `60fc6ef0-5cdc-4f53-a2ca-3f477964cb2a` (staging), валюта KZT.
Источник PMS: `daily_rates` (occupancy = вместимость категории, как при публикации) и `restrictions`;
ожидаемое строится по правилам публикации (нет цены → stop_sell; min_stay пусто → 1; max_stay пусто → 0).
Источник Channex: GET /restrictions (ari.md). Допуск: 0 клеток. Клетки, где канал закрыт из-за нулевого
остатка (stop_sell=true при availability=0 — поведение staging, в ari.md не описано), считаются отдельно.

## TOTALS

| Показатель | Значение |
|---|---:|
| Тарифов в маппинге (категория × тариф) | 10 |
| Проверено клеток (дата × категория × тариф) | 800 |
| Клеток без цены в PMS (ожидаем stop_sell в канале) | 0 |
| Клеток нет в Channex | 0 |
| Расхождений всего (строк) | 0 |
| — по цене | 0 |
| — по min_stay_arrival / min_stay_through | 0 / 0 |
| — по max_stay | 0 |
| — по stop_sell | 0 |
| — по closed_to_arrival / closed_to_departure | 0 / 0 |
| ОПАСНО: канал продаёт там, так или дешевле, чем мы разрешили | 0 |
| Закрыто каналом при нулевом остатке (не расхождение; остаток сверяет cli-channex-ari.ts) | 42 |

## BY TARIFF × CATEGORY

| Тариф | Категория | Тариф Channex | Клеток | Совпало | Клеток с расхождением |
|---|---|---|---:|---:|---:|
| Тариф для ОТА +35% (retired-source-10158310) | Одноместная комната с окном (retired-source-5074312) | `428d744c-0c7d-4469-9002-f323d4bf8cbe` | 80 | 80 | 0 |
| Тариф для ОТА +35% (retired-source-10158310) | Одноместная комната без окон (retired-source-5074686) | `2d1bc399-5857-4f98-a929-bffb8e16bcb9` | 80 | 80 | 0 |
| Тариф для ОТА +35% (retired-source-10158310) | Двухместная комната (retired-source-5074687) | `6ee98055-57cf-4831-a231-eba142307235` | 80 | 80 | 0 |
| Тариф для ОТА +35% (retired-source-10158310) | Общая мужская комната (retired-source-5074688) | `ba25fbce-fee3-47de-82a4-13443e8e9a85` | 80 | 80 | 0 |
| Тариф для ОТА +35% (retired-source-10158310) | Общая женская комната (retired-source-5074689) | `96d6b4fb-c209-45c2-9c01-668dc2e545d3` | 80 | 80 | 0 |
| Базовый тариф (retired-source-10157482) | Одноместная комната с окном (retired-source-5074312) | `9e9795e6-3bc2-4866-85a9-b2b770b4eaaa` | 80 | 80 | 0 |
| Базовый тариф (retired-source-10157482) | Одноместная комната без окон (retired-source-5074686) | `a3681abd-505c-42f9-bddb-4d606b46a973` | 80 | 80 | 0 |
| Базовый тариф (retired-source-10157482) | Двухместная комната (retired-source-5074687) | `ea6bfd9a-0cf3-48f9-a9af-7dce2b8dffc0` | 80 | 80 | 0 |
| Базовый тариф (retired-source-10157482) | Общая мужская комната (retired-source-5074688) | `e3c3fb2c-2589-4653-8fec-878e8e32cb95` | 80 | 80 | 0 |
| Базовый тариф (retired-source-10157482) | Общая женская комната (retired-source-5074689) | `f2b1124d-ca6a-4e73-9c35-700147d19e43` | 80 | 80 | 0 |

**RESULT: OK** — цены и ограничения совпадают клетка в клетку.

## ЗАКРЫТО КАНАЛОМ ПРИ НУЛЕВОМ ОСТАТКЕ (первые 42 из 42)

| Дата | Категория | Тариф | Цена PMS | Channex |
|---|---|---|---:|---|
| 2026-09-13 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-14 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-15 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-16 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-18 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-22 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-23 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-24 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-02 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-23 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-24 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-25 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-26 | retired-source-5074312 | retired-source-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-13 | retired-source-5074686 | retired-source-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-14 | retired-source-5074686 | retired-source-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-15 | retired-source-5074686 | retired-source-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-16 | retired-source-5074686 | retired-source-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-13 | retired-source-5074687 | retired-source-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-18 | retired-source-5074687 | retired-source-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-27 | retired-source-5074687 | retired-source-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-10-01 | retired-source-5074687 | retired-source-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-13 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-14 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-15 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-16 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-18 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-22 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-23 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-24 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-10-02 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-10-23 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-10-24 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-10-25 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-10-26 | retired-source-5074312 | retired-source-10157482 | 11000.00 | stop_sell=true, availability=0 |
| 2026-09-13 | retired-source-5074686 | retired-source-10157482 | 10000.00 | stop_sell=true, availability=0 |
| 2026-09-14 | retired-source-5074686 | retired-source-10157482 | 10000.00 | stop_sell=true, availability=0 |
| 2026-09-15 | retired-source-5074686 | retired-source-10157482 | 10000.00 | stop_sell=true, availability=0 |
| 2026-09-16 | retired-source-5074686 | retired-source-10157482 | 10000.00 | stop_sell=true, availability=0 |
| 2026-09-13 | retired-source-5074687 | retired-source-10157482 | 15000.00 | stop_sell=true, availability=0 |
| 2026-09-18 | retired-source-5074687 | retired-source-10157482 | 15000.00 | stop_sell=true, availability=0 |
| 2026-09-27 | retired-source-5074687 | retired-source-10157482 | 15000.00 | stop_sell=true, availability=0 |
| 2026-10-01 | retired-source-5074687 | retired-source-10157482 | 15000.00 | stop_sell=true, availability=0 |
