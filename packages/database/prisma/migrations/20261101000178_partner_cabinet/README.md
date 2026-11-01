# 178 Кабинет партнёра WETOP

Владелец 31.10.2026 «Да, делай этот срез и доводи до сайта», ТЗ VTOP 01.11.2026. DATA_MODEL §63.3.

Аддитивно:
- `platform_partners.user_id`, `organization_id`, `code` (уникальные, NULL): вход партнёра, его рабочее место для
  сессии, Partner ID в ссылке `register?p=P001`.
- `platform_partner_invites`: одноразовое приглашение партнёра, в базе только SHA-256 токена, срок 7 суток.
- `platform_client_partners.source` (`MANUAL`/`LINK`, по умолчанию `MANUAL`) и `channel`: откуда пришёл клиент.
Права как у 172: RLS нет, `wetop_app` без прав, `wetop_service` SELECT/INSERT/UPDATE без DELETE.

## Применение (production)
`sudo -n /usr/local/sbin/wetop-release-migrate`: копия базы, пробное восстановление, `prisma migrate deploy`,
проверка статуса, выкладка кода. Строки не меняются (UPDATE/DELETE нет).

## Проверка
`SELECT count(*) FROM platform_partner_invites;` = 0, у `platform_client_partners` все строки `source = 'MANUAL'`.

## Откат
`down.sql`: только пока нет приглашений, входов партнёров и клиентов по ссылке; иначе восстановление из копии.
