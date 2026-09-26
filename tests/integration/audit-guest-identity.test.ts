import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Аудит 25.09, В-5: карточка брони — «для стойки и для AuditLog» — уходила в журнал целиком, с именем и телефоном
 * гостя. После переезда базы в РК и «журнал только дописывается» (ADR-082) настоящие ФИО и телефоны стали бы в журнале
 * неудаляемыми. Здесь — что пишет в журнал сам репозиторий броней на настоящей базе. Строка в откатываемой транзакции.
 */
describe.skipIf(!url)('журнал броней без имени и контактов гостя (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('в строке журнала у гостя только id и гражданство', async () => {
    const entityId = randomUUID();
    const card = {
      confirmationNumber: '20260926-TEST01',
      primaryGuest: { id: randomUUID(), label: 'Айгерим Тестова', citizenship: 'KAZ', phone: '+77011234567' },
      items: [{ id: randomUUID(), guests: [{ label: 'Айгерим Тестова', isPrimary: true }] }],
    };
    let stored = '';
    await expect(
      db.$transaction(async (tx) => {
        const repo = new PrismaReservationsRepository(tx);
        await repo.audit({ entityType: 'Reservation', entityId, action: 'integration.audit.guest', before: card, after: card });
        const row = await tx.auditLog.findFirst({ where: { entityId, action: 'integration.audit.guest' } });
        stored = JSON.stringify({ before: row?.before, after: row?.after });
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    expect(stored).toContain('20260926-TEST01');
    expect(stored).toContain('KAZ');
    expect(stored).not.toContain('Тестова');
    expect(stored).not.toContain('7011234567');
  });
});
