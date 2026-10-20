import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { BeautyModule } from '../../../apps/api/src/beauty/beauty.module';
import { FoodModule } from '../../../apps/api/src/food-service/food.module';
import { bootApp, call, makeClients, url } from './harness';
import { seedBeautyFoodWorld, type BeautyFoodWorld } from './world';

/**
 * F3 (CORE-01), решение владельца о политике каталогов уровня бизнеса: вариант A. Каталог (мастера, услуги, меню)
 * читают все, кто работает в бизнесе; ЗАПИСЬ каталога, общего для всех филиалов бизнеса, закрыта человеку с областью
 * доступа. Филиальные настройки (услуга в филиале, график, привязка мастера к филиалу) остаются за ролью в филиале.
 *
 * Тест утверждает БЕЗОПАСНОЕ поведение: на коде до правки ограниченный менеджер и администратор получают 2xx/4xx
 * не от замка, а от обработчика.
 */
describe.skipIf(!url)(
  'F3: запись каталога уровня бизнеса закрыта ограниченному, чтение открыто',
  () => {
    let admin: Db;
    let tenant: Db;
    let app: INestApplication;
    let base = '';
    let w: BeautyFoodWorld;
    const bz = () => ({ businessId: w.ids.bz!, locationId: w.ids.bl1! });
    const fb = () => ({ businessId: w.ids.fb!, locationId: w.ids.fl1! });
    const any = () => randomUUID();

    beforeAll(async () => {
      ({ admin, tenant } = makeClients());
      w = await seedBeautyFoodWorld(admin);
      ({ app, base } = await bootApp([BeautyModule, FoodModule], tenant, w.actors));
    }, 120_000);

    afterAll(async () => {
      await app?.close();
      await tenant?.$disconnect();
      await admin?.$disconnect();
    });

    type Route = [method: 'GET' | 'PATCH' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown];
    const beautyWrites = (): Route[] => [
      ['POST', '/beauty/services', { name: 'F3 service' }],
      ['PATCH', `/beauty/services/${w.ids.svc}`, { name: 'F3 renamed' }],
      ['POST', '/beauty/employees', { firstName: 'F3' }],
      ['PATCH', `/beauty/employees/${w.ids.eBl1}`, { firstName: 'F3' }],
      ['PUT', `/beauty/employees/${w.ids.eBl1}/services`, { serviceIds: [] }],
    ];
    const foodWrites = (): Route[] => [
      ['POST', '/food-service/menu/categories', { name: 'F3 category' }],
      ['PATCH', `/food-service/menu/categories/${any()}`, { name: 'F3' }],
      ['POST', '/food-service/menu/items', { name: 'F3 item' }],
      ['PATCH', `/food-service/menu/items/${any()}`, { name: 'F3' }],
      ['PUT', `/food-service/menu/items/${any()}/ingredients`, { ingredients: [] }],
      ['DELETE', `/food-service/menu/items/${any()}/photo`],
    ];

    const run = (actor: string, scope: object, routes: Route[]) =>
      Promise.all(
        routes.map(async ([m, p, b]) => ({ m, p, r: await call(base, actor, m, p, scope, b) })),
      );

    it.each(['staffBl1', 'mgrBl1', 'mgrBz'])(
      'Beauty DENY: %s (ограничен) не пишет каталог бизнеса: 403',
      async (actor) => {
        for (const { m, p, r } of await run(actor, bz(), beautyWrites()))
          expect(r.status, `${actor} ${m} ${p}: ${r.text}`).toBe(403);
      },
    );

    it.each(['mgrFl1', 'staffFl1'])(
      'Food DENY: %s (ограничен) не пишет меню бизнеса: 403',
      async (actor) => {
        for (const { m, p, r } of await run(actor, fb(), foodWrites()))
          expect(r.status, `${actor} ${m} ${p}: ${r.text}`).toBe(403);
      },
    );

    it.each(['owner', 'orgMgr'])(
      'ALLOW: %s (без ограничения) не упирается в замок области',
      async (actor) => {
        for (const { m, p, r } of await run(actor, bz(), beautyWrites()))
          expect(r.status, `${actor} ${m} ${p}: ${r.text}`).not.toBe(403);
        for (const { m, p, r } of await run(actor, fb(), foodWrites()))
          expect(r.status, `${actor} ${m} ${p}: ${r.text}`).not.toBe(403);
      },
    );

    it('ALLOW: ограниченный по-прежнему читает каталоги и работает с филиальными настройками', async () => {
      for (const [m, p, b] of [
        ['GET', '/beauty/services'],
        ['GET', '/beauty/employees'],
        ['PUT', `/beauty/services/${w.ids.svc}/location`, { enabled: true }],
      ] as Route[]) {
        const r = await call(base, 'mgrBl1', m, p, bz(), b);
        expect(r.status, `${m} ${p}: ${r.text}`).not.toBe(403);
      }
      const menu = await call(base, 'mgrFl1', 'GET', '/food-service/menu/items', fb());
      expect(menu.status, menu.text).toBe(200);
    });
  },
);
