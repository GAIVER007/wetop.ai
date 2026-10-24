import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.provider';
import { ROUTE_ACCESS, type RouteAccess } from './access.decorator';
import { SessionGuard } from './auth.guard';
import { PUBLIC_ROUTE } from './public.decorator';
import { RoleGuard } from './role.guard';

/**
 * У каждого маршрута API записано право (ADR-107, DATA_MODEL §16.5): роли проверяет замок `RoleGuard` по метке
 * `@Access(…)`, и маршрут без метки вошедшему закрыт. Тест собирает настоящее приложение и сверяет каждый маршрут с
 * этой таблицей: новый маршрут без строки здесь — красный, смена права — только правкой строки. Так таблица и есть
 * полная карта доступа, которую читает человек.
 *
 * `public` — без входа (`@Public()`); `self` — своё, всем ролям; `platform` — главный администратор; `service` —
 * только служебный ключ.
 */
const EXPECTED: Record<string, RouteAccess | 'public'> = {
  // Owner reporting and existing cash linkage: read reports, mutate only with settings.
  'GET /owner-summary': 'reports',
  'GET /expenses': 'reports',
  'POST /expenses': 'settings',
  'POST /expenses/:id/settlements': 'settings',
  // Physical seating belongs to the desk; confirmed opening hours are property settings.
  'GET /food-service/occupancy-sessions': 'desk',
  'POST /food-service/occupancy-sessions': 'desk',
  'POST /food-service/occupancy-sessions/:id/closure': 'desk',
  'POST /food-service/occupancy-sessions/:id/relocations': 'desk',
  'GET /food-service/opening-schedule': 'reports',
  'PUT /food-service/opening-schedule': 'property',
  'GET /employee-portal/employees/:id': 'staff',
  'GET /employee-portal/employees/:id/account-options': 'staff',
  'PATCH /employee-portal/employees/:id/profile': 'staff',
  'PUT /employee-portal/employees/:id/avatar': 'staff',
  'DELETE /employee-portal/employees/:id/avatar': 'staff',
  'POST /employee-portal/employees/:id/portfolio': 'staff',
  'PATCH /employee-portal/employees/:id/portfolio/:workId': 'staff',
  'DELETE /employee-portal/employees/:id/portfolio/:workId': 'staff',
  'PUT /employee-portal/employees/:id/services': 'staff',
  'PUT /employee-portal/employees/:id/week': 'staff',
  'POST /employee-portal/employees/:id/time-offs': 'staff',
  'DELETE /employee-portal/employees/:id/time-offs/:timeOffId': 'staff',
  'PUT /employee-portal/employees/:id/publication': 'staff',
  'PUT /employee-portal/employees/:id/account': 'staff',
  'DELETE /employee-portal/employees/:id/account': 'staff',
  'PUT /employee-portal/employees/:id/pay-settings': 'staff',
  'GET /employee-portal/me': 'self',
  'PATCH /employee-portal/me/profile': 'self',
  'PUT /employee-portal/me/avatar': 'self',
  'DELETE /employee-portal/me/avatar': 'self',
  'POST /employee-portal/me/portfolio': 'self',
  'PATCH /employee-portal/me/portfolio/:workId': 'self',
  'DELETE /employee-portal/me/portfolio/:workId': 'self',
  'PUT /employee-portal/me/services': 'self',
  'PUT /employee-portal/me/week': 'self',
  'POST /employee-portal/me/time-offs': 'self',
  'DELETE /employee-portal/me/time-offs/:timeOffId': 'self',
  'PUT /employee-portal/pay-policy': 'staff',
  'GET /employee-portal/public/:slug': 'public',
  'GET /onboarding': 'self',
  'POST /onboarding': 'settings',
  'GET /branches': 'self',
  'POST /branches': 'owner',
  'GET /branches/locations/archived': 'owner',
  'POST /branches/locations/:id/archive': 'owner',
  'POST /branches/locations/:id/restore': 'owner',
  'POST /branches/businesses/:id/card': 'owner',
  'GET /branches/overview': 'reports',
  'GET /branches/summary': 'reports',
  // ── учётная запись, вход, сотрудники ─────────────────────────────────────────────────────
  'GET /auth/options': 'public',
  'POST /auth/login': 'public',
  'POST /auth/register': 'public',
  'POST /auth/email/verify': 'public',
  'POST /auth/email/verify-code': 'public',
  'POST /auth/email/resend': 'public',
  'POST /auth/logout': 'public',
  'POST /auth/password-reset/request': 'public',
  'POST /auth/password-reset/confirm': 'public',
  'GET /auth/me': 'self',
  'GET /auth/registration-context': 'self',
  'POST /auth/password': 'self',
  'POST /auth/locale': 'self',
  'GET /auth/sessions': 'self',
  'POST /auth/logout-all': 'self',
  'GET /auth/organizations': 'self',
  'POST /auth/organization': 'self',
  'POST /auth/invites': 'staff',
  'GET /auth/invites': 'staff',
  'DELETE /auth/invites/:id': 'staff',
  'GET /auth/invites/:token': 'public',
  'POST /auth/invites/:token/accept': 'public',
  'GET /auth/members': 'staff',
  'DELETE /auth/members/:userId': 'staff',
  'PATCH /auth/members/:userId': 'owner',
  'PATCH /auth/members/:userId/details': 'staff',
  'GET /auth/access-structure': 'staff',
  'PUT /auth/members/:userId/scopes': 'staff',
  'POST /auth/members/:userId/suspend': 'staff',
  'POST /auth/members/:userId/resume': 'staff',
  'GET /assistant/identity': 'self',
  'GET /assistant/errors': 'service',
  'GET /assistant/organization': 'service',
  'GET /assistant/requester': 'service',
  'GET /assistant/integrations': 'service',
  'GET /assistant/reservation': 'service',
  'POST /assistant/actions/channel-pull': 'service',
  'POST /assistant/actions/channel-sync': 'service',
  'GET /health': 'public',

  // ── работа с гостями ────────────────────────────────────────────────────────────────────
  'GET /desk/today': 'desk',
  'GET /desk/dashboard': 'desk',
  'GET /chessboard': 'desk',
  'GET /availability': 'desk',
  'GET /availability/offers': 'desk',
  // Бар: смена ведёт приход, продажи, списания и остатки; справочники меняют в настройках
  'GET /bar/categories': 'desk',
  'POST /bar/categories': 'settings',
  'PATCH /bar/categories/:id/active': 'settings',
  'GET /bar/products': 'desk',
  'POST /bar/products': 'settings',
  'PATCH /bar/products/:id/active': 'settings',
  'PATCH /bar/products/:id/price': 'settings',
  'PATCH /bar/products/:id': 'settings',
  'GET /bar/suppliers': 'desk',
  'POST /bar/suppliers': 'settings',
  'PATCH /bar/suppliers/:id/active': 'settings',
  'GET /bar/receipts': 'desk',
  'GET /bar/stock': 'desk',
  'GET /bar/payment-methods': 'desk',
  'GET /bar/sales': 'desk',
  'GET /bar/folios': 'desk',
  'GET /bar/movements': 'desk',
  'GET /bar/report': 'desk',
  'POST /bar/sales/retail': 'desk',
  'POST /bar/sales/folio': 'desk',
  // §62.3 «Меню бара»: продажа позиции меню, право как у продажи товара бара
  'POST /bar/sales/menu': 'desk',
  // сторно гасит кассовую операцию и начисление фолио, как аннулирования в /finance (ADR-181)
  'POST /bar/sales/:id/reverse': 'refunds',
  'POST /bar/write-offs': 'desk',
  'POST /bar/inventory-counts': 'desk',
  'POST /bar/receipts': 'desk',
  // ИИ-скан накладной (ADR-157): читает документ и ничего не создаёт, право как у самого прихода
  'POST /bar/receipts/scan': 'desk',
  'POST /bar/receipts/:id/post': 'desk',
  'POST /bar/receipts/:id/payments': 'desk',
  // Каталог салона (срез B3, Q-253): читать может смена, цены меняет `rates`, мастеров `property`
  // MV6 Food Service: explicit Business and Location on every route.
  // ── «Маркетинг → Бюджет», учёт расходов (МКТ-В1/В2, ADR-MKT-B1): право раздела, филиал строго из scope ──
  'GET /marketing/budget': 'marketing',
  'PUT /marketing/budget': 'marketing',
  'PUT /marketing/budget/lines': 'marketing',
  'GET /marketing/campaigns': 'marketing',
  'GET /marketing/ad-connections/meta': 'marketing',
  'POST /marketing/ad-connections/meta/start': 'marketing',
  'POST /marketing/ad-connections/meta/complete': 'marketing',
  'POST /marketing/ad-connections/meta/choose': 'marketing',
  'POST /marketing/ad-connections/meta/sync': 'marketing',
  'POST /marketing/ad-connections/meta/disconnect': 'marketing',
  'POST /marketing/campaigns': 'marketing',
  'PATCH /marketing/campaigns/:id': 'marketing',
  'PUT /marketing/campaigns/:id/stats': 'marketing',
  'POST /marketing/campaigns/:id/stats/import': 'marketing',
  'DELETE /marketing/campaigns/:id/stats/:date': 'marketing',
  // ИИ-таргетолог (ADR-MKT-LAUNCH, §57): предложение ИИ ничего не создаёт, но готовит запуск, право запуска
  'POST /marketing/ads/proposal': 'ads_launch',
  // «Контент»: черновики постов (CONTENT-DRAFTS-20261022), раздел «Маркетинг», в соцсети ничего не публикуется
  'POST /marketing/content/drafts/proposal': 'marketing',
  'GET /marketing/content/drafts': 'marketing',
  'POST /marketing/content/drafts': 'marketing',
  'PATCH /marketing/content/drafts/:id': 'marketing',
  'POST /marketing/content/drafts/:id/published': 'marketing',
  'POST /marketing/content/drafts/:id/archive': 'marketing',
  // запуск тратит деньги: креатив, запуск, «Остановить» и «Включить» под правом запуска; смотреть запуски: право раздела
  'POST /marketing/ads/creatives': 'ads_launch',
  'GET /marketing/ads/assets': 'ads_launch',
  'GET /marketing/ads/geo': 'ads_launch',
  'POST /marketing/ads/launches': 'ads_launch',
  'GET /marketing/ads/launches': 'marketing',
  // «Аудитории» и «Креативы» (23.10.2026): смотреть с правом раздела, аудитория в мастер только с правом запуска
  'GET /marketing/ads/library': 'marketing',
  'GET /marketing/ads/launches/:id/audience': 'ads_launch',
  'GET /marketing/ads/launches/:id': 'marketing',
  'POST /marketing/ads/campaigns/:id/pause': 'ads_launch',
  'POST /marketing/ads/campaigns/:id/resume': 'ads_launch',
  // МКТ-В5a: результаты каналов для «Аналитики маркетинга», право страницы
  'GET /marketing/results': 'marketing',
  'POST /marketing/expenses': 'marketing',
  'POST /marketing/expenses/import': 'marketing',
  'POST /marketing/expenses/:id/files': 'marketing',
  'DELETE /marketing/expenses/:id/files/:fileId': 'marketing',
  'PATCH /marketing/expenses/:id': 'marketing',
  'DELETE /marketing/expenses/:id': 'marketing',
  // ── «Маркетинг → Сайт и SEO», ядро сайта (MKT3): право сайта, филиал строго из scope ──
  'GET /marketing/site': 'marketing',
  // MKT9.2: заведение сайта с пустым телом вместо прежнего POST с названием и адресом
  'POST /marketing/site/bootstrap': 'marketing',
  'POST /marketing/site/from-template': 'marketing',
  'GET /marketing/site/context': 'marketing',
  'PATCH /marketing/site/context': 'marketing',
  'GET /marketing/site/conversation': 'marketing',
  'POST /marketing/site/assistant': 'marketing',
  'GET /marketing/site/assistant/:id': 'marketing',
  'POST /marketing/site/assistant/:id/approve': 'marketing',
  'PUT /marketing/site/versions/:id/bookmark': 'marketing',
  'DELETE /marketing/site/versions/:id/bookmark': 'marketing',
  'GET /marketing/site/brief': 'marketing',
  // SITE-2: выбор филиала для сайта и «что WETOP знает о филиале»; право settings ещё и в месте (site-facts.service.ts)
  'GET /marketing/site/locations': 'marketing',
  'GET /marketing/site/facts': 'marketing',
  'POST /marketing/site/generations': 'marketing',
  'GET /marketing/site/generations/:id': 'marketing',
  'GET /marketing/site/draft': 'marketing',
  'POST /marketing/site/versions': 'marketing',
  'GET /marketing/site/versions': 'marketing',
  'GET /marketing/site/versions/:id': 'marketing',
  'GET /marketing/site/versions/:id/diff': 'marketing',
  'POST /marketing/site/versions/:id/restore': 'marketing',
  // MKT7: превью, публикация, журнал, откат, пауза, архив и сайт брони филиала (Q-275)
  'POST /marketing/site/preview': 'marketing',
  'POST /marketing/site/publish': 'marketing',
  'POST /marketing/site/pause': 'marketing',
  'POST /marketing/site/resume': 'marketing',
  'POST /marketing/site/rollback': 'marketing',
  'POST /marketing/site/archive': 'marketing',
  'GET /marketing/site/publications': 'marketing',
  'GET /marketing/site/booking-source': 'marketing',
  'PUT /marketing/site/booking-source': 'marketing',
  'GET /marketing/site/assets': 'marketing',
  'POST /marketing/site/assets': 'marketing',
  'PATCH /marketing/site/assets/:id': 'marketing',
  'DELETE /marketing/site/assets/:id': 'marketing',
  'GET /marketing/site/assets/channex': 'marketing',
  // SITE-5 (ADR-185): заявки с сайта во «Входящих», как диалоги ИИ-продавца
  'GET /marketing/site/leads': 'dialogs',
  'PATCH /marketing/site/leads/:id': 'dialogs',
  'POST /marketing/site/assets/channex/import': 'marketing',
  'GET /food-service/areas': 'desk',
  'POST /food-service/areas': 'property',
  'PATCH /food-service/areas/:id': 'property',
  'PUT /food-service/areas/:id/layout': 'property',
  'GET /food-service/booking-rules': 'desk',
  // §61: напоминания гостям ресторана (настройки пишет право property, как у салона)
  'GET /food-service/reminder-settings': 'desk',
  'PUT /food-service/reminder-settings': 'property',
  'GET /food-service/reminders': 'desk',
  'POST /food-service/reminders/:id/done': 'desk',
  'PUT /food-service/booking-rules': 'property',
  'POST /food-service/closed-days': 'property',
  'DELETE /food-service/closed-days/:id': 'property',
  'GET /food-service/tables': 'desk',
  'POST /food-service/tables': 'property',
  'PATCH /food-service/tables/:id': 'property',
  'GET /food-service/service-periods': 'desk',
  'POST /food-service/service-periods': 'property',
  'PATCH /food-service/service-periods/:id': 'property',
  'GET /food-service/customers': 'desk',
  'GET /food-service/customers/:id': 'desk',
  'PATCH /food-service/customers/:id': 'desk',
  'GET /food-service/reservations': 'orders',
  'POST /food-service/reservations': 'orders',
  'PATCH /food-service/reservations/:id': 'desk',
  'POST /food-service/reservations/:id/status': 'desk',
  'PUT /food-service/reservations/:id/table': 'desk',
  'DELETE /food-service/reservations/:id/table': 'desk',
  // ── ресторан: меню, заказы, кухня, сотрудники, зарплата (§33, ADR-159) ─────────────────
  'GET /food-service/menu/categories': 'orders',
  'POST /food-service/menu/categories': 'property',
  'PATCH /food-service/menu/categories/:id': 'property',
  'GET /food-service/menu/items': 'orders',
  'GET /food-service/menu/items/:id': 'desk',
  'POST /food-service/menu/items': 'property',
  'PATCH /food-service/menu/items/:id': 'property',
  'PUT /food-service/menu/items/:id/ingredients': 'property',
  'GET /food-service/menu/modifier-groups': 'orders',
  'POST /food-service/menu/modifier-groups': 'property',
  'PATCH /food-service/menu/modifier-groups/:id': 'property',
  'PUT /food-service/menu/items/:id/modifier-groups': 'property',
  'POST /food-service/menu/items/:id/photo': 'property',
  'DELETE /food-service/menu/items/:id/photo': 'property',
  'GET /food-service/waiter/tables': 'orders',
  'GET /food-service/orders': 'orders',
  'POST /food-service/orders': 'orders',
  'PATCH /food-service/orders/:id': 'orders',
  'POST /food-service/orders/:id/status': 'desk',
  'POST /food-service/orders/:id/items/:itemId/status': 'orders',
  'POST /food-service/orders/:id/payments': 'desk',
  // возврат по закрытому заказу (§56)
  'POST /food-service/orders/:id/refunds': 'refunds',
  'POST /food-service/orders/:id/rating': 'desk',
  'POST /food-service/orders/:id/rating-link': 'desk',
  'POST /food-service/payments/:id/void': 'refunds',
  'GET /food-service/cash': 'desk',
  // способы оплаты филиала (§21.7): читает стойка, правят владелец и управляющий
  'GET /food-service/payment-methods': 'desk',
  'PUT /food-service/payment-methods': 'settings',
  'POST /food-service/cash/operations': 'desk',
  'POST /food-service/cash/operations/:id/void': 'refunds',
  'POST /food-service/cash/reconciliations': 'desk',
  'POST /food-service/tables/:id/cleaning': 'desk',
  'GET /food-service/report': 'desk',
  'GET /food-service/period-report': 'reports',
  'GET /food-service/staff-revenue': 'reports',
  'GET /food-service/employees': 'desk',
  'POST /food-service/employees': 'staff',
  'GET /food-service/shifts': 'desk',
  'PUT /food-service/employees/:id/working-hours': 'staff',
  'PATCH /food-service/employees/:id': 'staff',
  'PATCH /food-service/employees/:id/personnel-kind': 'staff',
  'GET /food-service/payroll': 'staff',
  'PUT /food-service/employees/:id/pay-settings': 'staff',
  'POST /food-service/employees/:id/pay-adjustments': 'staff',
  'POST /food-service/employees/:id/payouts': 'staff',
  // Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): справочник и сторно под `property`, работа склада под `desk`
  'GET /food-service/stock/products': 'desk',
  'POST /food-service/stock/products': 'property',
  'PATCH /food-service/stock/products/:id': 'property',
  'GET /food-service/stock/lots': 'desk',
  'GET /food-service/stock/movements': 'desk',
  'POST /food-service/stock/receipts': 'desk',
  'POST /food-service/stock/lots/:id/reverse': 'property',
  'POST /food-service/stock/write-offs': 'desk',
  'POST /food-service/stock/inventory': 'desk',
  // §62 заготовки: техкарта под `property`, «Приготовили» под `desk`
  'GET /food-service/stock/products/:id/recipe': 'desk',
  'PUT /food-service/stock/products/:id/recipe': 'property',
  'POST /food-service/stock/productions': 'desk',
  'GET /beauty/customers': 'desk',
  'GET /beauty/customers/:id': 'desk',
  'POST /beauty/customers': 'desk',
  'POST /beauty/customers/import/preview': 'desk',
  // импорт пишет клиентов: только владелец (решение владельца 19.10.2026), проверка файла остаётся стойке
  'POST /beauty/customers/import': 'owner',
  'GET /beauty/customer-imports': 'owner',
  'GET /beauty/customer-imports/:id': 'owner',
  'GET /beauty/customer-imports/:id/rows': 'owner',
  'POST /beauty/customer-imports': 'owner',
  'PUT /beauty/customer-imports/:id/rows': 'owner',
  'POST /beauty/customer-imports/:id/submit': 'owner',
  'POST /beauty/customer-imports/:id/undo': 'owner',
  // VIP и день рождения клиента салона (§36)
  'PATCH /beauty/customers/:id': 'desk',
  'GET /beauty/services': 'desk',
  'POST /beauty/services': 'rates',
  'PATCH /beauty/services/:id': 'rates',
  'PUT /beauty/services/:id/location': 'rates',
  'GET /beauty/services/:id/materials': 'rates',
  'PUT /beauty/services/:id/materials': 'rates',
  'GET /beauty/employees': 'desk',
  'POST /beauty/employees': 'property',
  'PATCH /beauty/employees/:id': 'property',
  'PATCH /beauty/employees/:id/personnel-kind': 'property',
  'PUT /beauty/employees/:id/services': 'property',
  'GET /beauty/employees/:id/service-prices': 'desk',
  'PUT /beauty/employees/:id/service-prices/:serviceId': 'rates',
  'DELETE /beauty/employees/:id/service-prices/:serviceId': 'rates',
  'PUT /beauty/employees/:id/locations': 'property',
  'GET /beauty/schedule': 'desk',
  'PUT /beauty/employees/:id/working-hours': 'property',
  'POST /beauty/employees/:id/time-offs': 'property',
  'DELETE /beauty/employees/:id/time-offs/:timeOffId': 'property',
  'GET /beauty/location-hours': 'desk',
  'PUT /beauty/location-hours': 'property',
  // напоминания клиентам (решение 21.10.2026 §1): настройки филиала, список дня и отметка «Напомнил»
  'GET /beauty/reminder-settings': 'desk',
  'PUT /beauty/reminder-settings': 'property',
  'GET /beauty/reminders': 'desk',
  'POST /beauty/reminders/:id/done': 'desk',
  // бонусы и сертификаты (решение 21.10.2026 §2-3): ручная правка бонусов только руководителю
  'GET /beauty/bonus-program': 'desk',
  'PUT /beauty/bonus-program': 'property',
  'GET /beauty/customers/:id/bonuses': 'desk',
  'POST /beauty/customers/:id/bonuses/adjustments': 'staff',
  'GET /beauty/gift-certificates': 'desk',
  'GET /beauty/gift-certificates/lookup': 'desk',
  'POST /beauty/gift-certificates': 'desk',
  'GET /beauty/appointments': 'desk',
  'GET /beauty/finance/day': 'desk',
  'GET /beauty/finance/appointments': 'desk',
  'GET /beauty/appointments/period': 'desk',
  'POST /beauty/appointments': 'desk',
  'PATCH /beauty/appointments/:id': 'desk',
  'POST /beauty/appointments/:id/status': 'desk',
  'GET /beauty/appointments/:id/history': 'desk',
  'POST /beauty/appointments/:id/review-invitation': 'desk',
  'GET /beauty/reviews/:token': 'public',
  'POST /beauty/reviews/:token': 'public',
  // оплата записи в кассу филиала (§49): принимает смена, как оплату заказа ресторана
  'POST /beauty/appointments/:id/payments': 'desk',
  // возврат по выполненной записи (§54): выделенное право возвратов
  'POST /beauty/appointments/:id/refunds': 'refunds',
  'GET /beauty/positions': 'staff',
  'POST /beauty/positions': 'staff',
  'PATCH /beauty/positions/:id': 'staff',
  'POST /beauty/positions/:id/archive': 'staff',
  'PUT /beauty/positions/assignments': 'staff',
  'POST /beauty/positions/assignments/:id/revoke': 'staff',
  'GET /availability/nearest': 'desk',
  'GET /reservations/:number': 'desk',
  'GET /hotel/reservations': 'desk',
  'GET /hotel/settings': 'desk',
  // фото и договор объекта (ADR-158): читают все с доступом к стойке, договор отдаётся только с правом `settings`
  'GET /hotel/media': 'desk',
  'GET /hotel/first-steps': 'desk',
  'GET /hotel/onboarding': 'desk',
  'GET /rate-plans': 'desk',
  'POST /reservations': 'desk',
  'POST /reservations/quote': 'desk',
  'PATCH /reservations/:number/dates': 'desk',
  'PATCH /reservations/:number': 'desk',
  'PATCH /reservations/:number/items/:itemId': 'desk',
  'POST /reservations/:number/cancel': 'desk',
  'POST /reservations/:number/items/:itemId/check-in': 'desk',
  'POST /reservations/:number/items/:itemId/check-out': 'desk',
  'POST /reservations/:number/items/:itemId/no-show': 'desk',
  'POST /reservations/:number/items/:itemId/extend': 'desk',
  'GET /reservations/:number/items/:itemId/preview': 'desk',
  'GET /reservations/:number/items/:itemId/move-preview': 'desk',
  'GET /reservations/:number/items/:itemId/extend-preview': 'desk',
  'GET /reservations/:number/cancel-preview': 'desk',
  'POST /reservations/:number/items/:itemId/assign': 'desk',
  'GET /guests': 'desk',
  'GET /guests/:id': 'desk',
  // «Гости v2» (G1–G3): каталог и предпросмотр гостя — работа смены
  'GET /guests/birthdays': 'desk',
  // Задачи стойки (DATA_MODEL §22): работа смены, все роли объекта
  'GET /tasks': 'desk',
  'POST /tasks': 'desk',
  'PATCH /tasks/:id': 'desk',
  'GET /guests/directory': 'desk',
  'GET /guests/:id/preview': 'desk',
  'PATCH /guests/:id': 'desk',
  'POST /guests/:id/documents': 'desk',
  'DELETE /guests/:id/documents/:documentId': 'desk',
  'GET /units/:code': 'desk',
  'POST /units/:code/blocks': 'desk',
  'DELETE /units/:code/blocks/:blockId': 'desk',
  'POST /units/:code/housekeeping': 'desk',
  'PUT /units/:code/housekeeping-assignee': 'desk',
  // кабинет горничной и ресепшена гостиницы (решение 22.10.2026): своё под `self`, сотрудники и график под `desk`/`staff`
  'GET /hotel-staff/me': 'self',
  'POST /hotel-staff/me/units/:code/clean': 'self',
  'POST /hotel-staff/me/tasks/:id/done': 'self',
  'GET /hotel-staff/employees': 'desk',
  'POST /hotel-staff/employees': 'staff',
  'GET /hotel-staff/shifts': 'desk',
  'PUT /hotel-staff/employees/:id/working-hours': 'staff',
  'GET /inventory/summary': 'desk',
  'GET /inventory/units': 'desk',
  'GET /inventory/trend': 'desk',
  'GET /inventory/occupancy': 'desk',
  'GET /inventory/photos': 'desk',
  'GET /system/freshness': 'desk',
  'GET /system/pii-storage': 'desk',
  // неисправности — работа смены; пробная тревога — настройка оповещений
  'GET /guard/status': 'desk',
  'GET /guard/incidents': 'desk',
  'GET /guard/reconciliation': 'desk',
  'POST /guard/incidents/:id/acknowledge': 'desk',
  'POST /guard/incidents/:id/resolve': 'desk',
  'POST /guard/tick': 'desk',
  'POST /guard/alert/test': 'settings',

  // ── деньги: оплаты и начисления — смена; возврат и сторно — владелец и управляющий (Q-024) ──
  'GET /finance/reservations/:number': 'desk',
  'GET /finance/services': 'desk',
  'POST /finance/folios/:id/charges': 'desk',
  'POST /finance/folios/:id/stay-extras': 'desk',
  'POST /finance/folios/:id/close': 'desk',
  'POST /finance/payments': 'desk',
  'POST /finance/payments/:id/receipt': 'desk',
  // Запросы оплаты (DATA_MODEL §24, ADR-144): администратор выставляет счёт и отмечает оплату
  'GET /finance/reservations/:number/payment-requests': 'desk',
  'POST /finance/reservations/:number/payment-requests': 'desk',
  'POST /finance/payment-requests/:id/paid': 'desk',
  'POST /finance/payment-requests/:id/cancel': 'desk',
  'POST /finance/charges/:id/void': 'refunds',
  'POST /finance/payments/:id/refunds': 'refunds',
  'POST /finance/payments/:id/void': 'refunds',
  'POST /finance/payments/:id/replace': 'refunds',
  'GET /finance/report': 'reports',
  'GET /finance/services-report': 'reports',
  'GET /desk/dashboard/units': 'reports',
  'GET /desk/dashboard/channels': 'reports',
  // «Финансы за период» F1–F2 (ADR-113): то же право, что у отчёта за период
  'GET /finance/debts': 'reports',
  'GET /finance/operations': 'reports',
  'GET /finance/cashflow': 'reports',
  'GET /finance/staff-revenue': 'reports',
  // касса (DATA_MODEL §21, Q-238): ведёт смена, как оплаты; аннулирование — как возврат; статьи — настройки
  'GET /finance/cash': 'desk',
  // справочник статей для «Настроек объекта» (ADR-185): владелец и управляющий
  'GET /finance/cash/categories': 'settings',
  'POST /finance/cash/categories': 'settings',
  'PATCH /finance/cash/categories/:id': 'settings',
  'POST /finance/cash/operations': 'desk',
  'POST /finance/cash/transfers': 'desk',
  'POST /finance/cash/reconciliations': 'desk',
  'POST /finance/cash/operations/:id/void': 'refunds',

  // загрузка конкурентов (ADR-142): смотрит, кто видит отчёты; ведёт список и вносит данные, кто ставит цены
  'GET /sales/summary': 'reports',
  'GET /market/occupancy': 'reports',
  'GET /market/rates': 'reports',
  'GET /market/night': 'reports',
  'POST /market/competitors': 'rates',
  'PATCH /market/competitors/:id': 'rates',
  'PUT /market/competitors/:id/occupancy': 'rates',
  'PUT /market/competitors/:id/rates': 'rates',
  // §60 конкуренты салона и ресторана: смотрит тот, кто видит отчёты; ведёт тот, кто ставит цены
  'GET /business-market': 'reports',
  'POST /business-market/competitors': 'rates',
  'PATCH /business-market/competitors/:id': 'rates',
  'PUT /business-market/competitors/:id/snapshot': 'rates',
  'GET /market/collector/competitors': 'service',
  'PUT /market/collector/competitors/:id/occupancy': 'service',
  'GET /business-market/collector/competitors': 'service',
  'PUT /business-market/collector/competitors/:id/days': 'service',
  // MKT4: публичный рантайм сайтов, только узкий ключ SITES_RUNTIME_KEY; чтения версии по id нет
  'GET /sites-runtime/current': 'service',
  'GET /sites-runtime/preview': 'service',
  // голосовой агент: события воркера только узким ключом VOICE_INGEST_KEY, журнал и просьбы по праву marketing
  'POST /voice/events': 'service',
  'GET /voice/profile': 'service',
  'GET /voice/availability': 'service',
  'GET /voice/beauty-catalog': 'service',
  'GET /voice/beauty-slots': 'service',
  'GET /voice/food-availability': 'service',
  'POST /voice/booking-quotes': 'service',
  'POST /voice/booking-quotes/confirm': 'service',
  'GET /marketing/voice/summary': 'marketing',
  'GET /marketing/voice/calls': 'marketing',
  'GET /marketing/voice/callbacks': 'marketing',
  'PATCH /marketing/voice/callbacks/:id': 'marketing',
  'GET /marketing/voice/booking': 'marketing',
  'GET /marketing/voice/bookings': 'marketing',
  'PATCH /marketing/voice/booking': 'marketing',

  // ── номерной фонд, тарифы ───────────────────────────────────────────────────────────────
  'GET /inventory/categories': 'property',
  'POST /inventory/categories': 'property',
  // «Настроить тариф» категории (ADR-119): как создание категории, которое тоже привязывает тариф
  'POST /inventory/categories/:code/rate-plan': 'property',
  'PATCH /inventory/categories/:code': 'property',
  'PUT /inventory/categories/:code/photos': 'property',
  'DELETE /inventory/categories/:code': 'property',
  'POST /inventory/rooms': 'property',
  'PATCH /inventory/rooms/:code': 'property',
  'GET /rates/options': 'rates',
  'GET /rates': 'rates',
  'POST /rates/bulk': 'rates',
  'GET /rates/plans': 'rates',
  'PATCH /rates/plans/:code': 'rates',
  'POST /rates/plans/derived': 'rates',
  'PATCH /rates/plans/:code/derived': 'rates',
  'GET /rates/promo-codes': 'rates',
  'POST /rates/promo-codes': 'rates',
  'PATCH /rates/promo-codes/:code': 'rates',

  // ── каналы: webhook Channex приходит снаружи со своим секретом ──────────────────────────
  'GET /channels/channex/mapping': 'channels',
  'POST /channels/channex/setup': 'channels',
  'POST /channels/channex/sync': 'channels',
  'POST /channels/channex/sync/scheduled': 'channels',
  'POST /channels/channex/availability/changed': 'channels',
  'POST /channels/channex/webhook': 'public',
  'GET /channels/channex/webhook/status': 'channels',
  'POST /channels/channex/webhook/register': 'channels',
  'POST /channels/channex/webhook/test': 'channels',
  'POST /channels/channex/pull': 'channels',
  'GET /channels/channex/events': 'channels',
  'GET /channels/channex/events/:revisionId': 'channels',
  'POST /channels/channex/events/:revisionId/retry': 'channels',
  'GET /channels/channex/outbox': 'channels',
  'GET /channels/channex/outbox/rows': 'channels',
  'GET /channels/channex/outbox/messages': 'channels',
  'POST /channels/channex/outbox/flush': 'channels',
  'GET /channels/channex/connection': 'channels',
  'GET /channels/channex/channels': 'channels',
  'POST /channels/channex/channels/connect-session': 'owner',
  'POST /channels/channex/channels/:id/load-future-reservations': 'owner',
  'GET /channels/channex/content': 'channels',
  'GET /channels/channex/content/names': 'channels',
  'GET /hotel/channel-report': 'channels',

  // ── настройки, интеграции, сайт, журнал ─────────────────────────────────────────────────
  'POST /hotel/onboarding': 'settings',
  'PATCH /hotel/settings': 'settings',
  'POST /hotel/media/photos': 'settings',
  'DELETE /hotel/media/photos/:id': 'settings',
  'POST /hotel/media/contract': 'settings',
  'DELETE /hotel/media/contract': 'settings',
  // каталог услуг «Настроек объекта» (SET3): право `settings` включает «услуги»
  'GET /hotel/services': 'settings',
  'POST /hotel/services': 'settings',
  'PATCH /hotel/services/:code': 'settings',
  // способы оплаты объекта (DATA_MODEL §21.6, ADR-185)
  'GET /hotel/payment-methods': 'settings',
  'PUT /hotel/payment-methods': 'settings',
  'GET /system/connection': 'settings',
  'GET /analytics/sites': 'marketing',
  'POST /analytics/sites': 'marketing',
  'GET /analytics/sites/:id': 'marketing',
  'PATCH /analytics/sites/:id': 'marketing',
  'DELETE /analytics/sites/:id': 'marketing',
  'GET /analytics/sites/:id/report': 'marketing',
  'GET /audit': 'journal',
  'GET /audit/actors': 'journal',

  // ── ИИ-продавец: диалоги — всем ролям, настройки — владельцу и управляющему ─────────────
  'GET /ai-seller/status': 'dialogs',
  'GET /ai-seller/catalog': 'dialogs',
  'GET /ai-seller/agents/options': 'dialogs',
  'POST /ai-seller/agents': 'seller',
  'GET /ai-seller/agents/:id': 'dialogs',
  'GET /ai-seller/agents/:id/instruction': 'seller',
  'GET /ai-seller/agents/:id/telegram': 'seller',
  'PUT /ai-seller/agents/:id/telegram': 'seller',
  'POST /ai-seller/agents/:id/telegram/check': 'seller',
  'POST /ai-seller/agents/:id/telegram/disconnect': 'seller',
  'PUT /ai-seller/agents/:id/instruction': 'seller',
  'POST /ai-seller/agents/:id/instruction/generate': 'seller',
  'GET /ai-seller/summary': 'dialogs',
  'GET /ai-seller/conversations': 'dialogs',
  'GET /ai-seller/conversations/:id': 'dialogs',
  'POST /ai-seller/conversations/:id/takeover': 'dialogs',
  'POST /ai-seller/conversations/:id/release': 'dialogs',
  'POST /ai-seller/conversations/:id/reply': 'dialogs',
  'PATCH /ai-seller/conversations/:id/handling': 'dialogs',
  'GET /ai-seller/prompt/versions': 'seller',
  'POST /ai-seller/prompt/versions/:id/restore': 'seller',
  'POST /ai-seller/conversations/:id/notes': 'dialogs',
  'GET /ai-seller/profile': 'seller',
  'PUT /ai-seller/profile': 'seller',
  'GET /ai-seller/prompt': 'seller',
  'PUT /ai-seller/prompt': 'seller',
  'POST /ai-seller/apply': 'seller',
  'POST /ai-seller/extract': 'seller',
  'GET /ai-seller/llm-key': 'seller',
  'GET /ai-seller/llm-usage': 'seller',
  'PUT /ai-seller/llm-key': 'seller',
  'POST /ai-seller/llm-key/check': 'seller',
  'GET /ai-seller/whatsapp': 'seller',
  'PUT /ai-seller/whatsapp': 'seller',
  'POST /ai-seller/whatsapp/check': 'seller',
  'GET /ai-seller/facts': 'seller',
  'GET /ai-seller/knowledge': 'seller',
  'POST /ai-seller/knowledge': 'seller',
  'POST /ai-seller/sandbox': 'seller',
  'GET /ai-seller/embed': 'seller',
  'GET /seller-agents': 'seller',
  'POST /seller-agents': 'seller',
  'GET /seller-agents/:id': 'seller',
  'PATCH /seller-agents/:id': 'seller',
  'POST /seller-agents/claim': 'seller',

  // ── «Платформа» — главный администратор (§16.2) ─────────────────────────────────────────
  'GET /platform/organizations': 'platform',
  'GET /platform/overview': 'platform',
  'PUT /platform/organizations/:id/extensions/ai-seller': 'platform',
  // оплата получена / «только чтение» (ADR-102): решает главный администратор
  'PUT /platform/organizations/:id/status': 'platform',
  // название, архив и возврат организации (ORG1, ADR-ORG1): только главный администратор
  'PATCH /platform/organizations/:id': 'platform',
  'POST /platform/organizations/:id/archive': 'platform',
  'POST /platform/organizations/:id/restore': 'platform',
  // создание организации и ссылка «задайте пароль» её владельцу (ORG2, ADR-ORG2)
  'POST /platform/organizations': 'platform',
  'POST /platform/organizations/:id/owner-link': 'platform',
  // MKT9.2: лицензии конструктора сайта по филиалам выдаёт только главный администратор
  'GET /platform/organizations/:id/site-builder': 'platform',
  'PUT /platform/organizations/:id/site-builder/:locationId': 'platform',
  'GET /platform/support/status': 'platform',
  'GET /platform/support/conversations': 'platform',
  'GET /platform/support/queue': 'platform',
  'GET /platform/support/conversations/:id': 'platform',
  'POST /platform/support/conversations/:id/takeover': 'platform',
  'POST /platform/support/conversations/:id/release': 'platform',
  'POST /platform/support/conversations/:id/reply': 'platform',
  'POST /platform/support/conversations/:id/close': 'platform',
  'GET /platform/support/knowledge': 'platform',
  'POST /platform/support/knowledge': 'platform',
  'GET /platform/support/kb': 'platform',
  'POST /platform/support/kb': 'platform',
  'GET /platform/support/kb/:id': 'platform',
  'PUT /platform/support/kb/:id': 'platform',
  'POST /platform/support/kb/:id/publish': 'platform',
  'POST /platform/support/kb/:id/status': 'platform',
  'GET /platform/support/conversations/:id/knowledge': 'platform',
  'GET /platform/support/conversations/:id/actions': 'platform',
  'POST /platform/support/conversations/:id/knowledge-draft': 'platform',
  'GET /platform/support/summary': 'platform',
  'GET /platform/support/prompt': 'platform',
  'PUT /platform/support/prompt': 'platform',
  'GET /platform/support/settings': 'platform',
  'PUT /platform/support/settings/model': 'platform',
  'POST /platform/support/sandbox': 'platform',

  // ── наружу без входа: сайт, виджет, котировка продавца, гостевой мастер ─────────────────
  'GET /a/pms.js': 'public',
  'POST /a/hit': 'public',
  'GET /a/demo': 'public',
  'GET /w/widget.js': 'public',
  'GET /w/config': 'public',
  // оценка официанта с телефона гостя (§40): только изнутри, страница стойки /rate/<ключ>
  'GET /public/order-rating/:token': 'public',
  'POST /public/order-rating/:token': 'public',
  'GET /w/availability': 'public',
  // Q-276: цена «от» тарифа брони сайта, тот же ключ и домен, что у availability
  'GET /w/from-prices': 'public',
  'POST /w/book': 'public',
  // SITE-4, SITE-5 (ADR-185): формы сайта салона и ресторана, заявка без слота; ключ сайта, домен, Turnstile, лимиты
  'GET /w/beauty/slots': 'public',
  'POST /w/beauty/book': 'public',
  'POST /w/food/reserve': 'public',
  'POST /w/lead': 'public',
  // STAFF-TG-20261020: вебхук бота уведомлений, пускает секрет X-Telegram-Bot-Api-Secret-Token
  'POST /telegram/staff/webhook': 'public',
  // «Профиль → Уведомления»: своё подключение Telegram
  'GET /profile/telegram': 'self',
  'POST /profile/telegram/code': 'self',
  'PATCH /profile/telegram': 'self',
  'DELETE /profile/telegram': 'self',
  'POST /profile/telegram/test': 'self',
  'GET /w/demo': 'public',
  'GET /bot/availability': 'public',
  // H14 (ADR-144): страница статуса сервиса без входа
  'GET /status/public': 'public',
  'GET /bot/agent-origins': 'public',
  'GET /bot/agent-context': 'public',
  'GET /bot/beauty-services': 'public',
  'GET /bot/food-service-periods': 'public',
  // ADR-144, DATA_MODEL §25: бронь из чата — узкий ключ записи продавца сверяет контроллер
  'POST /bot/booking-intents': 'public',
  'POST /bot/booking-intents/confirm': 'public',
  'POST /wizard/session': 'public',
  'GET /wizard/status': 'public',
  'PATCH /wizard/config': 'public',
  'POST /wizard/scan': 'public',
  'POST /wizard/generate': 'public',
  'POST /wizard/message': 'public',
  'GET /wizard/scan': 'public',
  'GET /wizard/quota': 'public',
  'POST /wizard/survey': 'public',
  'POST /wizard/event': 'public',
};

type Handler = (...args: unknown[]) => unknown;

/** Все маршруты собранного приложения: метод, путь и записанное право (метод сильнее класса) */
async function routes(): Promise<Record<string, RouteAccess | 'public' | undefined>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ db: {} })
    .compile();
  const found: Record<string, RouteAccess | 'public' | undefined> = {};
  for (const module of moduleRef.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const cls = wrapper.metatype as (new (...args: never[]) => unknown) | null;
      if (!cls) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, cls) ?? '');
      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        const handler = (cls.prototype as Record<string, Handler>)[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (path === undefined || method === undefined) continue;
        const full = `/${[base, path].filter(Boolean).join('/')}`
          .replace(/\/+/g, '/')
          .replace(/(.)\/$/, '$1');
        const key = `${RequestMethod[method]} ${full}`;
        const isPublic =
          Reflect.getMetadata(PUBLIC_ROUTE, handler) ?? Reflect.getMetadata(PUBLIC_ROUTE, cls);
        const access = (Reflect.getMetadata(ROUTE_ACCESS, handler) ??
          Reflect.getMetadata(ROUTE_ACCESS, cls)) as RouteAccess | undefined;
        expect(key in found, `маршрут ${key} объявлен дважды`).toBe(false);
        found[key] = isPublic ? 'public' : access;
      }
    }
  }
  await moduleRef.close();
  return found;
}

describe('права маршрутов API (ADR-107)', () => {
  it('у каждого маршрута — право из таблицы, и в таблице нет лишних строк', async () => {
    const actual = await routes();
    const unannotated = Object.entries(actual)
      .filter(([, access]) => access === undefined)
      .map(([key]) => key);
    expect(unannotated, 'маршруты без @Access и без @Public').toEqual([]);
    expect(actual).toEqual(EXPECTED);
  });

  it('MKT4, MKT7: у рантайма сайтов два пути, только GET (текущая версия и превью по токену); чтения версии по id нет', async () => {
    const actual = await routes();
    const runtime = Object.keys(actual).filter((key) => /\/sites-runtime(\/|$)/.test(key));
    expect(runtime.sort()).toEqual(['GET /sites-runtime/current', 'GET /sites-runtime/preview']);
    // Статус задачи генерации (MKT6) читается по id, но версии и документа не отдаёт (tests/integration/site-generation.test.ts)
    // MKT8: ассет по id только правится (ALT) и удаляется; чтения ассета по id нет ни у управления, ни у рантайма
    // MKT9: версия по id читается, сравнивается и восстанавливается только управлением (вошедший, `settings`, строгий
    // scope филиала); рантайм по-прежнему видит только текущую опубликованную версию и превью по токену
    const allowed = [
      'GET /marketing/site/generations/:id',
      'PATCH /marketing/site/assets/:id',
      'DELETE /marketing/site/assets/:id',
      'GET /marketing/site/versions/:id',
      'GET /marketing/site/versions/:id/diff',
      'POST /marketing/site/versions/:id/restore',
      // MKT9.2: разговорная задача читается и план одобряется по id; закладка ставится и снимается у версии этого сайта
      'GET /marketing/site/assistant/:id',
      'POST /marketing/site/assistant/:id/approve',
      'PUT /marketing/site/versions/:id/bookmark',
      'DELETE /marketing/site/versions/:id/bookmark',
      // SITE-5: статус заявки своего филиала (право dialogs, строгий scope филиала)
      'PATCH /marketing/site/leads/:id',
    ];
    const byId = Object.keys(actual).filter(
      (key) => /\/(marketing\/site|sites-runtime)\/.*:id/.test(key) && !allowed.includes(key),
    );
    expect(byId, 'по id только явно перечисленные маршруты управления').toEqual([]);
    expect(Object.keys(actual).filter((key) => /^GET .*assets\/:id/.test(key))).toEqual([]);
  });

  it('замок ролей стоит сразу за замком входа: без сессии роль не узнать', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) ?? []) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    const guards = providers.filter((p) => p.provide === APP_GUARD).map((p) => p.useClass);
    expect(guards).toEqual([SessionGuard, RoleGuard]);
  });
});
