import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { SHIFT_REQUIRED_MESSAGE, assertShiftOpen, shiftRequired } from './shift-guard';

/**
 * Владелец 27.10.2026: «пока смена не открыта нельзя вносить брони и т.д.». Сторож сервера: администратор без
 * открытой смены получает понятный отказ, владелец и управляющий правят, онлайн-запись клиента (без вошедшего) идёт.
 */
const db = (open: boolean) =>
  ({
    $queryRaw: async () => [{ open }],
  }) as never;
const as = (role: string | null, fn: () => Promise<unknown>) =>
  withSignedInUser(
    role === null
      ? null
      : ({ userId: 'user', organizationId: 'org', role, scope: 'LOCATION', locationId: 'branch', businessId: 'b' } as never),
    fn,
  );
const where = { propertyId: null, locationId: 'branch' };

describe('сторож открытой смены', () => {
  it('кого держит: администратора и личный кабинет; владельца, управляющего и сайт нет', () => {
    expect(shiftRequired('STAFF', 'u')).toBe(true);
    expect(shiftRequired('EMPLOYEE', 'u')).toBe(true);
    expect(shiftRequired('OWNER', 'u')).toBe(false);
    expect(shiftRequired('MANAGER', 'u')).toBe(false);
    expect(shiftRequired(null, null)).toBe(false);
  });
  it('администратор без открытой смены получает отказ с подсказкой, где открыть смену', async () => {
    await expect(as('STAFF', () => assertShiftOpen(db(false), where))).rejects.toThrow(SHIFT_REQUIRED_MESSAGE);
    expect(SHIFT_REQUIRED_MESSAGE).toMatch(/Открыть смену/);
  });
  it('администратор с открытой сменой проходит', async () => {
    await expect(as('STAFF', () => assertShiftOpen(db(true), where))).resolves.toBeUndefined();
  });
  it('владелец проходит и без смены, база не спрашивается', async () => {
    const strict = { $queryRaw: async () => { throw new Error('не должен спрашивать'); } } as never;
    await expect(as('OWNER', () => assertShiftOpen(strict, where))).resolves.toBeUndefined();
  });
  it('онлайн-запись клиента (никто не вошёл) проходит без смены', async () => {
    await expect(as(null, () => assertShiftOpen(db(false), where))).resolves.toBeUndefined();
  });
});
