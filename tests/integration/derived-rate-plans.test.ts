import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';
config({ quiet: true });

/**
 * Производный тариф и промокод на уровне базы (DATA_MODEL §20, ADR-124, срез D4): то, что доказывает сама база —
 * форма правила, «родитель — обычный тариф того же объекта и валюты», уникальность и формат промокода.
 */
describe.skipIf(!process.env.DATABASE_URL)('derived rate plans and promo codes: database guards', () => {
  it('accepts a valid derived plan and rejects every broken shape', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST d4 ${marker}` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST d4 ${marker}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const other = await createPropertyInChain(db, org.id, {
      name: `TEST d4 other ${marker}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const plan = (code: string, extra: Record<string, unknown> = {}, propertyId = property.id) =>
      db.ratePlan.create({ data: { propertyId, code, name: code, currency: 'KZT', ...extra } as never });
    try {
      const base = await plan('BASE');
      // верный производный: родитель, процент, окна и минимум ночей
      const early = await plan('EARLY', {
        parentRatePlanId: base.id,
        discountPercent: 15,
        minDaysBeforeArrival: 30,
        minNights: 2,
      });
      expect(early.discountPercent).toBe(15);

      // процент без родителя и условия без родителя — форма нарушена
      await expect(plan('NOPARENT', { discountPercent: 10 })).rejects.toThrow();
      await expect(plan('NOPARENT2', { minNights: 3 })).rejects.toThrow();
      // родитель без процента
      await expect(plan('NOPERCENT', { parentRatePlanId: base.id })).rejects.toThrow();
      // процент вне 1…90, окно наоборот, минимум ночей 0
      await expect(plan('P0', { parentRatePlanId: base.id, discountPercent: 0 })).rejects.toThrow();
      await expect(plan('P91', { parentRatePlanId: base.id, discountPercent: 91 })).rejects.toThrow();
      await expect(
        plan('WIN', { parentRatePlanId: base.id, discountPercent: 5, minDaysBeforeArrival: 10, maxDaysBeforeArrival: 5 }),
      ).rejects.toThrow();
      await expect(plan('N0', { parentRatePlanId: base.id, discountPercent: 5, minNights: 0 })).rejects.toThrow();
      // производный от производного
      await expect(plan('CHAIN', { parentRatePlanId: early.id, discountPercent: 5 })).rejects.toThrow(/производным/);
      // родитель на другом объекте и в другой валюте
      const foreign = await plan('FOREIGN', {}, other.id);
      await expect(plan('XPROP', { parentRatePlanId: foreign.id, discountPercent: 5 })).rejects.toThrow(/объекте/);
      const usd = await db.ratePlan.create({
        data: { propertyId: property.id, code: 'USD', name: 'USD', currency: 'USD' },
      });
      await expect(plan('XCUR', { parentRatePlanId: usd.id, discountPercent: 5 })).rejects.toThrow(/валюте/);
      // тариф с производными сам стать производным не может
      await expect(
        db.ratePlan.update({ where: { id: base.id }, data: { parentRatePlanId: usd.id, discountPercent: 5 } }),
      ).rejects.toThrow();
      // родителя с производными удалить нельзя
      await expect(db.ratePlan.delete({ where: { id: base.id } })).rejects.toThrow();

      // промокод: верный, дубль кода на объекте, формат, процент, период, предел
      const promo = await db.promoCode.create({
        data: { propertyId: property.id, code: 'SUMMER10', discountPercent: 10, maxUses: 5 },
      });
      expect(promo.active).toBe(true);
      await expect(
        db.promoCode.create({ data: { propertyId: property.id, code: 'SUMMER10', discountPercent: 5 } }),
      ).rejects.toThrow();
      // тот же код на другом объекте — можно
      await db.promoCode.create({ data: { propertyId: other.id, code: 'SUMMER10', discountPercent: 5 } });
      await expect(
        db.promoCode.create({ data: { propertyId: property.id, code: 'ab', discountPercent: 5 } }),
      ).rejects.toThrow();
      await expect(
        db.promoCode.create({ data: { propertyId: property.id, code: 'lower1', discountPercent: 5 } }),
      ).rejects.toThrow();
      await expect(
        db.promoCode.create({ data: { propertyId: property.id, code: 'BIG', discountPercent: 91 } }),
      ).rejects.toThrow();
      await expect(
        db.promoCode.create({
          data: {
            propertyId: property.id,
            code: 'PERIOD',
            discountPercent: 5,
            stayFrom: new Date('2026-12-10'),
            stayTo: new Date('2026-12-01'),
          },
        }),
      ).rejects.toThrow();
      await expect(
        db.promoCode.create({ data: { propertyId: property.id, code: 'USES0', discountPercent: 5, maxUses: 0 } }),
      ).rejects.toThrow();
    } finally {
      await db.promoCode.deleteMany({ where: { propertyId: { in: [property.id, other.id] } } });
      await db.ratePlan.deleteMany({
        where: { propertyId: { in: [property.id, other.id] }, parentRatePlanId: { not: null } },
      });
      await db.ratePlan.deleteMany({ where: { propertyId: { in: [property.id, other.id] } } });
      await db.property.deleteMany({ where: { id: { in: [property.id, other.id] } } });
      await deleteOrganizationChain(db, [org.id]);
      await db.organization.delete({ where: { id: org.id } });
      await db.$disconnect();
    }
  });
});
