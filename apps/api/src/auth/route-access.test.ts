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
  'GET /branches': 'desk',
  'POST /branches': 'owner',
  'GET /branches/overview': 'reports',
  // ── учётная запись, вход, сотрудники ─────────────────────────────────────────────────────
  'GET /auth/options': 'public',
  'POST /auth/login': 'public',
  'POST /auth/register': 'public',
  'POST /auth/email/verify': 'public',
  'POST /auth/email/resend': 'public',
  'POST /auth/logout': 'public',
  'POST /auth/password-reset/request': 'public',
  'POST /auth/password-reset/confirm': 'public',
  'GET /auth/me': 'self',
  'POST /auth/password': 'self',
  'GET /auth/sessions': 'self',
  'POST /auth/logout-all': 'self',
  'POST /auth/invites': 'staff',
  'GET /auth/invites': 'staff',
  'DELETE /auth/invites/:id': 'staff',
  'GET /auth/invites/:token': 'public',
  'POST /auth/invites/:token/accept': 'public',
  'GET /auth/members': 'staff',
  'DELETE /auth/members/:userId': 'staff',
  'PATCH /auth/members/:userId': 'owner',
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
  'GET /availability/nearest': 'desk',
  'GET /reservations/:number': 'desk',
  'GET /hotel/reservations': 'desk',
  'GET /hotel/settings': 'desk',
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
  'GET /guests/directory': 'desk',
  'GET /guests/:id/preview': 'desk',
  'PATCH /guests/:id': 'desk',
  'POST /guests/:id/documents': 'desk',
  'DELETE /guests/:id/documents/:documentId': 'desk',
  'GET /units/:code': 'desk',
  'POST /units/:code/blocks': 'desk',
  'DELETE /units/:code/blocks/:blockId': 'desk',
  'POST /units/:code/housekeeping': 'desk',
  'GET /inventory/summary': 'desk',
  'GET /inventory/units': 'desk',
  'GET /system/freshness': 'desk',
  'GET /system/pii-storage': 'desk',
  // неисправности — работа смены; пробная тревога — настройка оповещений
  'GET /guard/status': 'desk',
  'GET /guard/incidents': 'desk',
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
  'POST /finance/charges/:id/void': 'refunds',
  'POST /finance/payments/:id/refunds': 'refunds',
  'GET /finance/report': 'reports',
  'GET /finance/services-report': 'reports',
  'GET /desk/dashboard/units': 'reports',
  // «Финансы за период» F1–F2 (ADR-113): то же право, что у отчёта за период
  'GET /finance/debts': 'reports',
  'GET /finance/operations': 'reports',
  // касса (DATA_MODEL §21, Q-238): ведёт смена, как оплаты; аннулирование — как возврат; статьи — настройки
  'GET /finance/cash': 'desk',
  'POST /finance/cash/categories': 'settings',
  'PATCH /finance/cash/categories/:id': 'settings',
  'POST /finance/cash/operations': 'desk',
  'POST /finance/cash/transfers': 'desk',
  'POST /finance/cash/reconciliations': 'desk',
  'POST /finance/cash/operations/:id/void': 'refunds',

  // загрузка конкурентов (ADR-141): смотрит, кто видит отчёты; ведёт список и вносит данные, кто ставит цены
  'GET /market/occupancy': 'reports',
  'POST /market/competitors': 'rates',
  'PATCH /market/competitors/:id': 'rates',
  'PUT /market/competitors/:id/occupancy': 'rates',

  // ── номерной фонд, тарифы ───────────────────────────────────────────────────────────────
  'GET /inventory/categories': 'property',
  'POST /inventory/categories': 'property',
  // «Настроить тариф» категории (ADR-119): как создание категории, которое тоже привязывает тариф
  'POST /inventory/categories/:code/rate-plan': 'property',
  'PATCH /inventory/categories/:code': 'property',
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
  // каталог услуг «Настроек объекта» (SET3): право `settings` включает «услуги»
  'GET /hotel/services': 'settings',
  'POST /hotel/services': 'settings',
  'PATCH /hotel/services/:code': 'settings',
  'GET /system/connection': 'settings',
  'GET /analytics/sites': 'settings',
  'POST /analytics/sites': 'settings',
  'GET /analytics/sites/:id': 'settings',
  'PATCH /analytics/sites/:id': 'settings',
  'DELETE /analytics/sites/:id': 'settings',
  'GET /analytics/sites/:id/report': 'settings',
  'GET /audit': 'journal',

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
  'GET /ai-seller/profile': 'seller',
  'PUT /ai-seller/profile': 'seller',
  'GET /ai-seller/prompt': 'seller',
  'PUT /ai-seller/prompt': 'seller',
  'POST /ai-seller/apply': 'seller',
  'POST /ai-seller/extract': 'seller',
  'GET /ai-seller/llm-key': 'seller',
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
  'PUT /platform/organizations/:id/extensions/ai-seller': 'platform',
  // оплата получена / «только чтение» (ADR-102): решает главный администратор
  'PUT /platform/organizations/:id/status': 'platform',
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
  'GET /w/availability': 'public',
  'POST /w/book': 'public',
  'GET /w/demo': 'public',
  'GET /bot/availability': 'public',
  'GET /bot/agent-origins': 'public',
  'POST /wizard/session': 'public',
  'GET /wizard/status': 'public',
  'PATCH /wizard/config': 'public',
  'GET /wizard/quota': 'public',
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
        const full = `/${[base, path].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
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

  it('замок ролей стоит сразу за замком входа: без сессии роль не узнать', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) ?? []) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    const guards = providers.filter((p) => p.provide === APP_GUARD).map((p) => p.useClass);
    expect(guards).toEqual([SessionGuard, RoleGuard]);
  });
});
