import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY, resolvePaymentMethodSettings } from '@pms/domain';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Способы оплаты объекта на настоящей схеме (DATA_MODEL §21.6, миграция 20261007000062): без строк умолчания,
 * строки задают порядок и включение, EXTERNAL не хранится (CHECK), способ у объекта один (уникальный ключ).
 * Строки теста свои и удаляются в конце.
 */
describe.skipIf(!url)('способы оплаты объекта (integration, DATA_MODEL §21.6)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let propertyId = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as unknown as PrismaService);
    const property = await db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    expect(property, 'в тестовой базе нужен объект стенда').toBeTruthy();
    propertyId = property!.id;
    await db.paymentMethodSetting.deleteMany({ where: { propertyId } });
  });
  afterAll(async () => {
    if (!db) return;
    await db.paymentMethodSetting.deleteMany({ where: { propertyId } });
    await db.$disconnect();
  });

  it('без строк репозиторий отдаёт пусто, а домен из пустого делает умолчания', async () => {
    expect(await repo.paymentMethodSettings()).toEqual([]);
    expect(resolvePaymentMethodSettings([]).every((m) => m.enabled)).toBe(true);
  });

  it('строки объекта читаются по порядку; EXTERNAL и повтор способа база не принимает', async () => {
    await db.paymentMethodSetting.createMany({
      data: [
        { propertyId, method: 'KASPI', enabled: true, sortOrder: 0 },
        { propertyId, method: 'CASH', enabled: false, sortOrder: 1 },
      ],
    });
    const rows = await repo.paymentMethodSettings();
    expect(rows.map((r) => [r.method, r.enabled])).toEqual([
      ['KASPI', true],
      ['CASH', false],
    ]);
    const resolved = resolvePaymentMethodSettings(rows);
    expect(resolved[0]).toEqual({ method: 'KASPI', enabled: true });
    expect(resolved).toHaveLength(8);
    await expect(
      db.paymentMethodSetting.create({
        data: { propertyId, method: 'EXTERNAL', enabled: true, sortOrder: 9 },
      }),
    ).rejects.toThrow(/payment_method_settings_method_configurable/);
    await expect(
      db.paymentMethodSetting.create({
        data: { propertyId, method: 'KASPI', enabled: false, sortOrder: 5 },
      }),
    ).rejects.toThrow();
  });
});
