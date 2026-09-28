# «Брони v2», срез R2 — отбор на сервере и в адресе (27.09.2026)

Решение — дополнение к ADR-106, план — `plans/reservations-v2-r2-2026-09-27.md`. Данные на снимках
вымышленные (подставной API UI-стенда, ADR-010).

## Снимки стоп-гейта (светлая и тёмная тема, 1440 × 1000; телефон 390)

| Снимок | Адрес |
|---|---|
| `*-today.png` — «Сегодня» | `/reservations?view=today` |
| `*-future.png` — «Будущие» | `/reservations?view=future` |
| `*-attention.png` — «Требуют внимания» | `/reservations?view=attention` |
| `*-debt.png` — «Есть долг», по долгу | `/reservations?payment=due&sort=debt` |
| `*-unassigned.png` — «Без размещения» | `/reservations?allocation=missing` |
| `*-combo.png` — сочетание через форму | после «Показать»: `/reservations?view=today&source=WHATSAPP&payment=due&sort=arrival` |
| `*-empty.png` — пустое состояние | `/reservations?view=inhouse&source=Hostelworld&payment=refunded` |
| `*-390-debt.png` — телефон, «Фильтры» раскрыты | `/reservations?payment=due` |

Адреса, снятые самим тестом, — `urls-light.txt`, `urls-dark.txt`.

## Проверки

| Набор | Итог | Лог |
|---|---|---|
| unit | 2130/2133 (3 пропуска macOS) | `2026-09-27T21-45-09Z-unit-ab07.log` |
| typecheck | чисто | `2026-09-27T21-13-31Z-typecheck-9b19.log` |
| lint | чисто | `2026-09-27T21-13-58Z-lint-357f.log` |
| integration (локальный PostgreSQL) | 108/108 | `2026-09-27T21-46-25Z-integration-6d22.log` |
| e2e живые (локальный PostgreSQL) | 25/25 | `2026-09-27T21-47-19Z-e2e-b79b.log` |
| UI, весь набор, один поток | 412/413 — красный только `ai-seller.spec.ts:107`, красный и в `main` | `2026-09-27T21-13-26Z-e2e-11de.log` |

Красное до правки (red before green): юнит справочника 9/18 (`…20-54-27Z-unit-70f9.log`), интеграционный
отбор (`…20-57-38Z-integration-354d.log`), модуль адреса (`…21-05-10Z-unit-d26e.log`).
