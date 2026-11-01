# 179 Профиль партнёра VTOP

ТЗ владельца 01.11.2026 «VTOP Partner Cabinet» (п. 5, 7, 8), DATA_MODEL §63.4.

Аддитивно: `platform_partners.specialization`, `city`, `experience_years` (CHECK 0..60), `about`, все NULL.
Права не меняются: таблица закрыта миграцией 172.

## Применение (production)
`sudo -n /usr/local/sbin/wetop-release-migrate --check-sql`, затем `sudo -n /usr/local/sbin/wetop-release-migrate`.
Строки не меняются (UPDATE/DELETE нет).

## Проверка
`SELECT count(*) FROM platform_partners WHERE specialization IS NOT NULL;` = 0 сразу после применения.

## Откат
`down.sql`: только пока профили пустые; иначе восстановление из копии.
