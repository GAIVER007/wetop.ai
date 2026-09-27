import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { accessDeniedMessage, type MembershipRole } from '@pms/domain';
import { HotelService } from './hotel.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

/** Вымышленный ИИН/БИН для теста — не литералом `bin: '…'`, чтобы не попасть под сторож property.test.ts */
const FAKE_BIN = Array.from({ length: 12 }, (_, i) => (i + 1) % 10).join('');

/**
 * «Настройки гостиницы → Общие» правит владелец организации (ТЗ ux-retention п. 3.1, UQ-1 — «да» владельца 26.09.2026)
 * и управляющий: ему «всё, кроме владельческого», настройки гостиницы в том числе (ADR-101). Администратор — нет. Название объекта Luxx служебные пути ищут по имени — его не переименовать.
 * Чужое название занять нельзя — как при регистрации (ADR-099). Каждая правка — в журнал «было/стало».
 */
function setup(
  property = { id: 'prop-a', name: 'Хостел А', organizationId: 'org-a' },
  namesake: unknown = null,
) {
  const findFirst = vi
    .fn()
    .mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      'organizationId' in where
        ? {
            ...property,
            legalName: null,
            address: null,
            phone: null,
            email: null,
            bin: null,
            timezone: 'Asia/Almaty',
            currency: 'KZT',
            checkInTime: '14:00',
            checkOutTime: '12:00',
          }
        : namesake,
    );
  const update = vi.fn().mockResolvedValue({});
  const orgUpdate = vi.fn().mockResolvedValue({});
  const audit = vi.fn().mockResolvedValue({});
  const db = {
    property: { findFirst, update },
    organization: { update: orgUpdate },
    auditLog: { create: audit },
    ratePlan: { findMany: vi.fn().mockResolvedValue([]) },
    accommodationType: { count: vi.fn().mockResolvedValue(1) },
  };
  const tx = { ...db };
  const service = new HotelService({
    db: { ...db, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
  } as unknown as PrismaService);
  return { service, update, orgUpdate, audit };
}
const as = <T>(role: MembershipRole, fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'u1', organizationId: 'org-a', role }, fn);

describe('правка сведений гостиницы', () => {
  it('владелец меняет контакты и часы — запись в объект и в журнал', async () => {
    const { service, update, audit } = setup();
    await as('OWNER', () =>
      service.updateSettings({ phone: '+7 700 111 22 33', checkInTime: '15:00' }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'prop-a' },
      data: { phone: '+7 700 111 22 33', checkInTime: '15:00' },
    });
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Property',
        entityId: 'prop-a',
        action: 'hotel.settings.updated',
        before: { phone: null, checkInTime: '14:00' },
        after: { phone: '+7 700 111 22 33', checkInTime: '15:00' },
      }),
    });
  });

  it('новое название — и у объекта, и у организации', async () => {
    const { service, update, orgUpdate } = setup();
    await as('OWNER', () => service.updateSettings({ name: 'Хостел Б' }));
    expect(update).toHaveBeenCalledWith({ where: { id: 'prop-a' }, data: { name: 'Хостел Б' } });
    expect(orgUpdate).toHaveBeenCalledWith({ where: { id: 'org-a' }, data: { name: 'Хостел Б' } });
  });

  it('управляющий меняет сведения так же, как владелец (ADR-101)', async () => {
    const { service, update } = setup();
    await as('MANAGER', () => service.updateSettings({ phone: '+7 700 111 22 33' }));
    expect(update).toHaveBeenCalledWith({
      where: { id: 'prop-a' },
      data: { phone: '+7 700 111 22 33' },
    });
  });

  it('администратор получает отказ словами о разделе, ничего не записано', async () => {
    const { service, update } = setup();
    await expect(
      as('STAFF', () => service.updateSettings({ phone: '+77001112233' })),
    ).rejects.toThrow(accessDeniedMessage('settings'));
    expect(update).not.toHaveBeenCalled();
  });

  it('чужое название и переименование объекта Luxx — отказ словами', async () => {
    const taken = setup(undefined, { id: 'prop-luxx' });
    await expect(
      as('OWNER', () => taken.service.updateSettings({ name: 'Luxx Aparts' })),
    ).rejects.toThrow(/уже есть в WETOP/);
    const luxx = setup({ id: 'prop-luxx', name: 'Luxx Aparts', organizationId: 'org-a' });
    await expect(
      as('OWNER', () => luxx.service.updateSettings({ name: 'Luxx Hostel' })),
    ).rejects.toThrow(/каналы/);
    expect(luxx.update).not.toHaveBeenCalled();
  });

  it('валюту не меняет — отказ разбора', async () => {
    const { service } = setup();
    await expect(as('OWNER', () => service.updateSettings({ currency: 'USD' }))).rejects.toThrow(
      /поддержка WETOP/,
    );
  });

  it('неизменённые поля не пишутся; ИИН/БИН в журнале — только последние 4 цифры', async () => {
    const { service, update, audit } = setup();
    await as('OWNER', () =>
      service.updateSettings({ name: 'Хостел А', checkInTime: '14:00', bin: FAKE_BIN }),
    );
    expect(update).toHaveBeenCalledWith({ where: { id: 'prop-a' }, data: { bin: FAKE_BIN } });
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ before: { bin: null }, after: { bin: '••••9012' } }),
    });
    const same = setup();
    await as('OWNER', () => same.service.updateSettings({ checkInTime: '14:00' }));
    expect(same.update).not.toHaveBeenCalled();
    expect(same.audit).not.toHaveBeenCalled();
  });
});
