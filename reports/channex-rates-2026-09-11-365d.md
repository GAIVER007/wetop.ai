# Цены и ограничения: PMS против Channex (2026-09-11 → 2027-09-10)

CONTROL DATE: 2026-09-11
PERIOD: 2026-09-11 → 2027-09-10 (365 дн.)

Снято 2026-09-11 10:07 UTC. Объект Channex `60fc6ef0-5cdc-4f53-a2ca-3f477964cb2a` (staging), валюта KZT.
Источник PMS: `daily_rates` (occupancy = вместимость категории, как при публикации) и `restrictions`;
ожидаемое строится по правилам публикации (нет цены → stop_sell; min_stay пусто → 1; max_stay пусто → 0).
Источник Channex: GET /restrictions (ari.md). Допуск: 0 клеток. Клетки, где канал закрыт из-за нулевого
остатка (stop_sell=true при availability=0 — поведение staging, в ari.md не описано), считаются отдельно.

## TOTALS

| Показатель | Значение |
|---|---:|
| Тарифов в маппинге (категория × тариф) | 5 |
| Проверено клеток (дата × категория × тариф) | 1825 |
| Клеток без цены в PMS (ожидаем stop_sell в канале) | 5 |
| Клеток нет в Channex | 0 |
| Расхождений всего (строк) | 0 |
| — по цене | 0 |
| — по min_stay_arrival / min_stay_through | 0 / 0 |
| — по max_stay | 0 |
| — по stop_sell | 0 |
| — по closed_to_arrival / closed_to_departure | 0 / 0 |
| ОПАСНО: канал продаёт там, так или дешевле, чем мы разрешили | 0 |
| Закрыто каналом при нулевом остатке (не расхождение; остаток сверяет cli-channex-ari.ts) | 25 |

## BY TARIFF × CATEGORY

| Тариф | Категория | Тариф Channex | Клеток | Совпало | Клеток с расхождением |
|---|---|---|---:|---:|---:|
| Тариф для ОТА +35% (exely-10158310) | Одноместная комната с окном (exely-5074312) | `428d744c-0c7d-4469-9002-f323d4bf8cbe` | 365 | 365 | 0 |
| Тариф для ОТА +35% (exely-10158310) | Одноместная комната без окон (exely-5074686) | `2d1bc399-5857-4f98-a929-bffb8e16bcb9` | 365 | 365 | 0 |
| Тариф для ОТА +35% (exely-10158310) | Двухместная комната (exely-5074687) | `6ee98055-57cf-4831-a231-eba142307235` | 365 | 365 | 0 |
| Тариф для ОТА +35% (exely-10158310) | Общая мужская комната (exely-5074688) | `ba25fbce-fee3-47de-82a4-13443e8e9a85` | 365 | 365 | 0 |
| Тариф для ОТА +35% (exely-10158310) | Общая женская комната (exely-5074689) | `96d6b4fb-c209-45c2-9c01-668dc2e545d3` | 365 | 365 | 0 |

**RESULT: OK** — цены и ограничения совпадают клетка в клетку.

## ЗАКРЫТО КАНАЛОМ ПРИ НУЛЕВОМ ОСТАТКЕ (первые 25 из 25)

| Дата | Категория | Тариф | Цена PMS | Channex |
|---|---|---|---:|---|
| 2026-09-11 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-12 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-13 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-14 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-18 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-22 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-23 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-24 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-02 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-23 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-24 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-25 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-10-26 | exely-5074312 | exely-10158310 | 15400.00 | stop_sell=true, availability=0 |
| 2026-09-11 | exely-5074686 | exely-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-12 | exely-5074686 | exely-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-13 | exely-5074686 | exely-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-14 | exely-5074686 | exely-10158310 | 14000.00 | stop_sell=true, availability=0 |
| 2026-09-11 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-14 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-15 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-16 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-18 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-27 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-10-01 | exely-5074687 | exely-10158310 | 21000.00 | stop_sell=true, availability=0 |
| 2026-09-11 | exely-5074688 | exely-10158310 | 9000.00 | stop_sell=true, availability=0 |
