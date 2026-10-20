import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { BarModule } from '../../apps/api/src/bar/bar.module';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import {
  actorOf,
  bootApp,
  call,
  makeClients,
  seedHotel,
  seedUser,
  url,
  type Actor,
  type Hotel,
} from './core-security/harness';

/**
 * Бар гостиницы на настройке способов оплаты объекта (DATA_MODEL §21.6, ADR-185, план
 * plans/bar-payment-methods-2026-10-15.md): настоящая база, настоящий API, строки `payment_method_settings`
 * объекта филиала. Товар и приход тут не нужны: способ проверяется раньше, чем ищется товар (400 против 404).
 */
describe.skipIf(!url)('бар: способы оплаты объекта (integration, DATABASE_URL required)', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base = '';
  let hotel: Hotel;
  const actors = new Map<string, Actor>();
  const org = randomUUID();

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    await admin.organization.create({ data: { id: org, name: `BPM-${org}`, status: 'ACTIVE' } });
    hotel = await seedHotel(admin, org, `BPM hotel ${org.slice(0, 8)}`, undefined, 'P');
    const owner = await seedUser(admin, org, 'OWNER', 'bpmowner');
    actors.set('owner', actorOf(owner, org, 'OWNER'));
    // настройка объекта: Halyk первым, Kaspi выключен, остальное умолчанием дописывает домен
    await admin.paymentMethodSetting.createMany({
      data: [
        { propertyId: hotel.propertyId, method: 'HALYK', enabled: true, sortOrder: 0 },
        { propertyId: hotel.propertyId, method: 'CASH', enabled: true, sortOrder: 1 },
        { propertyId: hotel.propertyId, method: 'KASPI', enabled: false, sortOrder: 2 },
      ],
    });
    forgetPropertyRef();
    ({ app, base } = await bootApp([BarModule], tenant, actors));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    forgetPropertyRef();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  const scope = () => ({ businessId: hotel.businessId, locationId: hotel.locationId });

  it('GET /bar/payment-methods: порядок настройки, без выключенного Kaspi, только способы бара', async () => {
    const r = await call(base, 'owner', 'GET', '/bar/payment-methods', scope());
    expect(r.status, r.text).toBe(200);
    expect(r.json).toEqual({
      sale: ['HALYK', 'CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON'],
      supplier: ['HALYK', 'CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL'],
    });
  });

  it('продажа выключенным способом: 400 словами настройки; включённым проходит до поиска товара (404)', async () => {
    const body = (method: string) => ({
      productId: randomUUID(),
      quantityUnits: '1',
      method,
      idempotencyKey: randomUUID(),
    });
    const refused = await call(base, 'owner', 'POST', '/bar/sales/retail', scope(), body('KASPI'));
    expect(refused.status, refused.text).toBe(400);
    expect(refused.json).toMatchObject({ message: 'Способ оплаты «Kaspi» выключен в настройках объекта' });
    const passed = await call(base, 'owner', 'POST', '/bar/sales/retail', scope(), body('HALYK'));
    expect(passed.status, passed.text).toBe(404);
  });

  it('оплата поставщику выключенным способом: 400; включённым доходит до прихода (404)', async () => {
    const path = `/bar/receipts/${randomUUID()}/payments`;
    const refused = await call(base, 'owner', 'POST', path, scope(), { amountMinor: '100', method: 'KASPI', idempotencyKey: randomUUID() });
    expect(refused.status, refused.text).toBe(400);
    const passed = await call(base, 'owner', 'POST', path, scope(), { amountMinor: '100', method: 'BANK_TRANSFER_LEGAL', idempotencyKey: randomUUID() });
    expect(passed.status, passed.text).toBe(404);
  });
});
