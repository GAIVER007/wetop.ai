import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { AuditService } from '../../apps/api/src/audit/audit.module';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

/**
 * Разделы риска «Истории действий» на настоящем Postgres (владелец 30.10.2026): скидка только когда цена стала меньше,
 * отмена записи салона, возврат; сводка периода считает число и сумму. Строки журнала вымышленные, своя организация.
 */
loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const db = createPrismaClient();
const orgId = randomUUID();
const svc = new AuditService({ db } as unknown as PrismaService);

beforeAll(async () => {
  await db.organization.create({ data: { id: orgId, name: `audit-risk ${orgId.slice(0, 8)}` } });
  const at = new Date('2026-10-20T12:00:00Z');
  const base = { organizationId: orgId, entityType: 'appointment', entityId: randomUUID(), createdAt: at };
  await db.auditLog.createMany({
    data: [
      { ...base, action: 'beauty.appointment.price_adjusted', before: { priceMinor: '50000', currency: 'QAR' }, after: { priceMinor: '35000', currency: 'QAR', reason: 'постоянная клиентка', paidMinor: '0' } },
      { ...base, action: 'beauty.appointment.price_adjusted', before: { priceMinor: '30000' }, after: { priceMinor: '40000', reason: 'доп. объём' } },
      { ...base, action: 'beauty.appointment.status', before: { status: 'BOOKED' }, after: { status: 'CANCELLED' } },
      { ...base, action: 'beauty.appointment.status', before: { status: 'BOOKED' }, after: { status: 'DONE' } },
      { ...base, action: 'beauty.appointment.refunded', after: { amountMinor: '30000', method: 'CASH', reason: 'не понравилось' } },
    ],
  });
});
afterAll(async () => {
  // журнал только дописывается (миграция 20260925000022): уборка своих строк с отметкой в той же транзакции
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
    await tx.$executeRaw`DELETE FROM audit_logs WHERE organization_id = ${orgId}::uuid`;
  });
  await db.organization.delete({ where: { id: orgId } });
  await db.$disconnect();
});

describe('История действий: разделы риска на Postgres', () => {
  it('скидкой считается только снижение цены, отменой только CANCELLED/NO_SHOW', async () => {
    const rows = (await svc.list({ limit: 50 })).filter((r) => r.entityType === 'appointment' && r.at.startsWith('2026-10-20'));
    const mine = rows.filter((r) => r.after['currency'] === 'QAR' || r.after['reason'] || r.after['status'] || r.after['amountMinor']);
    const risk = mine.map((r) => [r.action, r.after['status'] ?? r.after['priceMinor'] ?? r.after['amountMinor'], r.risk]);
    expect(risk).toEqual(expect.arrayContaining([
      ['beauty.appointment.price_adjusted', '35000', 'discount'],
      ['beauty.appointment.price_adjusted', '40000', null],
      ['beauty.appointment.status', 'CANCELLED', 'cancel'],
      ['beauty.appointment.status', 'DONE', null],
      ['beauty.appointment.refunded', '30000', 'refund'],
    ]));
    const discount = mine.find((r) => r.risk === 'discount')!;
    expect(discount.before).toMatchObject({ priceMinor: '50000' });
    expect(discount.after).toMatchObject({ priceMinor: '35000', reason: 'постоянная клиентка' });
  });

  it('group=risk отдаёт только рисковые строки', async () => {
    const rows = await svc.list({ limit: 50, group: 'risk' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.risk && r.risk !== 'access')).toBe(true);
  });

  it('сводка за период: скидка 150 QAR, возврат 300 QAR', async () => {
    const s = await svc.summary({ from: '2026-10-20', to: '2026-10-20', timezone: 'Asia/Qatar' });
    expect(s.discount.count).toBeGreaterThanOrEqual(1);
    expect(Number(s.discount.minor)).toBeGreaterThanOrEqual(15000);
    expect(s.cancel.count).toBeGreaterThanOrEqual(1);
    expect(Number(s.refund.minor)).toBeGreaterThanOrEqual(30000);
    expect(s.currency).toBe('QAR');
  });
});
