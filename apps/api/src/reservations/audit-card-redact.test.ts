import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { PrismaReservationsRepository } from './reservations.repository';
import type { ReservationCard } from './reservation-card';

/**
 * В-5 из ТЗ аудита 25.09.2026: карточка брони писалась в `audit_logs` как есть — с ФИО (`label`)
 * и телефоном гостя. Пока гости псевдонимизированы это «Гость Канал-a1b2c3», но после
 * `PII_STORAGE=real` настоящие ФИО потекли бы в журнал, который с миграции №22 только дописывается —
 * ПД стали бы неудаляемыми. Теперь на пути в журнал карточка проходит проекцию: гость — по `id`,
 * телефон — маской (`maskNumber`), ФИО в журнал не пишутся. Стойке карточка отдаётся полной.
 */
const CARD: ReservationCard = {
  confirmationNumber: '20260925-TEST01',
  source: 'DESK',
  channel: null,
  externalId: null,
  status: 'CONFIRMED',
  arrivalDate: '2026-09-26',
  departureDate: '2026-09-28',
  adults: 2,
  children: 0,
  currency: 'KZT',
  totalAmountMinor: '2200000',
  notes: null,
  primaryGuest: {
    id: 'g-1',
    label: 'Айгерим Тестова',
    citizenship: 'KAZ',
    phone: '+7 701 123 45 67',
  },
  items: [
    {
      id: 'i-1',
      accommodationTypeCode: 'exely-900001',
      accommodationTypeName: 'Одиночная',
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      status: 'CONFIRMED',
      priceMinor: '2200000',
      ratePlanCode: null,
      ratePlanName: null,
      adults: 2,
      children: 0,
      unitCode: '9001',
      unitHousekeepingStatus: null,
      guests: [
        { id: 'g-1', label: 'Айгерим Тестова', isPrimary: true },
        { id: 'g-2', label: 'Санжар Тестов', isPrimary: false },
      ],
    },
  ],
};

function capture() {
  const rows: Array<{ data: Record<string, unknown> }> = [];
  const db = {
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        rows.push(args);
        return args.data;
      },
    },
  } as unknown as Db;
  return { db, rows };
}

describe('В-5: карточка брони в журнале — без ФИО, телефон маской', () => {
  it('before/after-карточки редактируются на пути в журнал: id гостя вместо label, телефон маской', async () => {
    const { db, rows } = capture();
    const repo = new PrismaReservationsRepository(db);
    await repo.audit({
      entityType: 'Reservation',
      entityId: 'r-1',
      action: 'reservation.create',
      after: CARD,
    });
    expect(rows).toHaveLength(1);
    const stored = JSON.stringify(rows[0]!.data);
    expect(stored).not.toContain('Айгерим');
    expect(stored).not.toContain('Тестов');
    expect(stored).not.toContain('+7 701 123 45 67');
    const after = rows[0]!.data.after as {
      primaryGuest: { id: string; phone: string | null; label?: string };
      items: Array<{ guests: Array<{ id?: string; label?: string; isPrimary: boolean }> }>;
    };
    expect(after.primaryGuest.id).toBe('g-1');
    expect(after.primaryGuest.label).toBeUndefined();
    // маска существующего вида: последние 4 знака видны (packages/shared maskNumber)
    expect(after.primaryGuest.phone).toMatch(/^\*+4567$/);
    expect(after.items[0]!.guests).toEqual([
      { id: 'g-1', isPrimary: true },
      { id: 'g-2', isPrimary: false },
    ]);
  });

  it('не-карточки в журнал идут как были: проекция не трогает другие записи', async () => {
    const { db, rows } = capture();
    const repo = new PrismaReservationsRepository(db);
    const plain = { statusFrom: 'CONFIRMED', statusTo: 'CANCELLED' };
    await repo.audit({
      entityType: 'Reservation',
      entityId: 'r-1',
      action: 'reservation.cancel',
      after: plain,
    });
    expect(rows[0]!.data.after).toEqual(plain);
  });
});
