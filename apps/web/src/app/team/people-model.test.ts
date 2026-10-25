import { describe, expect, it } from 'vitest';
import type { AuthInvite, AuthMember } from '../../lib/api';
import { accessLabel, peopleRows, peopleTabs, resendExtra } from './people-model';

/** Общий экран «Сотрудники» салона и ресторана (plans/unified-team-screen-2026-10-25.md, U2) */
const member = (userId: string, extra: Partial<AuthMember> = {}): AuthMember => ({
  userId,
  email: `${userId}@example.invalid`,
  name: null,
  role: 'STAFF',
  joinedAt: '2026-10-01T00:00:00.000Z',
  lastLoginAt: null,
  you: false,
  removable: true,
  roleEditable: true,
  phone: null,
  position: null,
  detailsEditable: true,
  suspended: false,
  suspendable: true,
  scopes: [],
  scopesEditable: true,
  ...extra,
});
const invite = (id: string, extra: Partial<AuthInvite> = {}): AuthInvite => ({
  id,
  email: `${id}@example.invalid`,
  expiresAt: '2026-10-30T00:00:00.000Z',
  acceptedAt: null,
  createdAt: '2026-10-25T00:00:00.000Z',
  ...extra,
});
const anna = { id: 'e-anna', name: 'Анна', personnelKind: 'SPECIALIST' as const };
const oleg = { id: 'e-oleg', name: 'Олег', personnelKind: 'OTHER_EMPLOYEE' as const };

describe('peopleRows', () => {
  it('одна строка на человека, у каждой строки свой ключ; старый API без employees не падает', () => {
    const rows = peopleRows([anna, oleg], {
      businessId: 'b-1',
      members: [
        member('u-anna', { employees: [{ employeeId: 'e-anna', businessId: 'b-1' }] }),
        member('u-acc'),
        member('u-old'),
      ],
      invites: [invite('i-1'), invite('i-oleg', { employeeId: 'e-oleg' })],
    });
    expect(rows.map((r) => [r.id, r.kind, r.access])).toEqual([
      ['e-anna', 'linked', 'STAFF'],
      ['e-oleg', 'invited', 'INVITED'],
      ['member:u-acc', 'login', 'STAFF'],
      ['member:u-old', 'login', 'STAFF'],
      ['invite:i-1', 'invited', 'INVITED'],
    ]);
  });

  it('без списка входов (администратор): только карточки, доступ не известен', () => {
    expect(peopleRows([anna], null).map((r) => [r.id, r.kind, r.access])).toEqual([['e-anna', 'card', null]]);
  });
});

describe('peopleTabs', () => {
  it('прежние вкладки карточек плюс «С доступом» и «Ждут приглашения»; без списка входов их нет', () => {
    const rows = peopleRows([anna, oleg], {
      businessId: 'b-1',
      members: [member('u-anna', { employees: [{ employeeId: 'e-anna', businessId: 'b-1' }] }), member('u-acc')],
      invites: [invite('i-oleg', { employeeId: 'e-oleg' })],
    });
    const tabs = peopleTabs(rows, [{ id: 'specialists', rows: [anna] }], true);
    expect(tabs.map((t) => [t.id, t.rows.map((r) => r.id)])).toEqual([
      ['all', ['e-anna', 'e-oleg', 'member:u-acc']],
      ['specialists', ['e-anna']],
      ['access', ['e-anna', 'member:u-acc']],
      ['invited', ['e-oleg']],
    ]);
    expect(peopleTabs(peopleRows([anna], null), [], false).map((t) => t.id)).toEqual(['all']);
  });
});

describe('accessLabel', () => {
  it('словами колонки «Доступ в WETOP»', () => {
    expect(['NONE', 'INVITED', 'SUSPENDED', 'EMPLOYEE', 'STAFF', 'MANAGER', 'OWNER', null].map((a) => accessLabel(a as never))).toEqual([
      'Без входа',
      'Ждёт ответа',
      'Приостановлен',
      'Личный кабинет',
      'Администратор',
      'Управляющий',
      'Владелец',
      '',
    ]);
  });
});

describe('resendExtra', () => {
  it('повторная отправка сохраняет карточку и «все филиалы», иначе вход не привяжется к сотруднику', () => {
    expect(resendExtra(invite('i', { employeeId: 'e-1', scopes: [] }))).toEqual({ employeeId: 'e-1', allBranches: true });
    const scopes = [{ role: 'EMPLOYEE' as const, businessId: 'b-1', locationId: 'l-1' }];
    expect(resendExtra(invite('i', { employeeId: 'e-1', scopes, firstName: 'Анна' }))).toEqual({
      firstName: 'Анна',
      scopes,
      employeeId: 'e-1',
    });
    expect(resendExtra(invite('i', { position: 'Бухгалтер' }))).toEqual({ position: 'Бухгалтер' });
  });
});
