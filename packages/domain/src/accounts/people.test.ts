import { describe, expect, it } from 'vitest';
import { pairPeople, type PeopleMember } from './people';

/** Один экран «Сотрудники» (plans/unified-team-screen-2026-10-25.md, В1–В7 вариант А): карточка и вход по user_id */
const B = 'b-salon';
const member = (userId: string, extra: Partial<PeopleMember> = {}): PeopleMember => ({
  userId,
  role: 'STAFF',
  suspended: false,
  scopes: [],
  employees: [],
  ...extra,
});
const keys = (rows: ReturnType<typeof pairPeople>) => rows.map((r) => [r.kind, r.access, r.employee?.id ?? null, r.member?.userId ?? null, r.invite?.id ?? null]);

describe('pairPeople', () => {
  it('сводит карточку и вход одного человека в одну строку, владелец первым (В4)', () => {
    const rows = pairPeople({
      businessId: B,
      employees: [{ id: 'e-anna' }, { id: 'e-bob' }],
      members: [
        member('u-anna', { employees: [{ employeeId: 'e-anna', businessId: B }] }),
        member('u-owner', { role: 'OWNER' }),
      ],
      invites: [],
    });
    expect(keys(rows)).toEqual([
      ['login', 'OWNER', null, 'u-owner', null],
      ['linked', 'STAFF', 'e-anna', 'u-anna', null],
      ['card', 'NONE', 'e-bob', null, null],
    ]);
  });

  it('владелец с карточкой мастера: одна строка, первой', () => {
    const rows = pairPeople({
      businessId: B,
      employees: [{ id: 'e-bob' }, { id: 'e-owner' }],
      members: [member('u-owner', { role: 'OWNER', employees: [{ employeeId: 'e-owner', businessId: B }] })],
      invites: [],
    });
    expect(keys(rows)).toEqual([
      ['linked', 'OWNER', 'e-owner', 'u-owner', null],
      ['card', 'NONE', 'e-bob', null, null],
    ]);
  });

  it('вход без карточки в этом бизнесе: строка «только вход» (В3), карточка другого бизнеса не считается', () => {
    const rows = pairPeople({
      businessId: B,
      employees: [],
      members: [member('u-acc', { employees: [{ employeeId: 'e-elsewhere', businessId: 'b-cafe' }] })],
      invites: [],
    });
    expect(keys(rows)).toEqual([['login', 'STAFF', null, 'u-acc', null]]);
  });

  it('приглашение с карточкой: строка карточки ждёт; без карточки: своя строка; чужого бизнеса: нет', () => {
    const rows = pairPeople({
      businessId: B,
      employees: [{ id: 'e-new' }],
      members: [],
      invites: [
        { id: 'i-card', employeeId: 'e-new' },
        { id: 'i-plain', employeeId: null },
        { id: 'i-cafe', employeeId: 'e-cafe' },
      ],
    });
    expect(keys(rows)).toEqual([
      ['invited', 'INVITED', 'e-new', null, 'i-card'],
      ['invited', 'INVITED', null, null, 'i-plain'],
    ]);
  });

  it('вход сильнее приглашения, приостановленный виден как приостановленный', () => {
    const rows = pairPeople({
      businessId: B,
      employees: [{ id: 'e-anna' }],
      members: [member('u-anna', { suspended: true, employees: [{ employeeId: 'e-anna', businessId: B }] })],
      invites: [{ id: 'i-old', employeeId: 'e-anna' }],
    });
    expect(keys(rows)).toEqual([['linked', 'SUSPENDED', 'e-anna', 'u-anna', null]]);
  });

  it('вход с назначением только в другой бизнес здесь не показывается (В6)', () => {
    const rows = pairPeople({
      businessId: B,
      employees: [],
      members: [
        member('u-here', { scopes: [{ businessId: B }] }),
        member('u-cafe', { scopes: [{ businessId: 'b-cafe' }] }),
        member('u-org'),
      ],
      invites: [],
    });
    expect(keys(rows).map((r) => r[3])).toEqual(['u-here', 'u-org']);
  });

  it('без права на входы (администратор, В2): только карточки, доступ не известен', () => {
    const rows = pairPeople({ businessId: B, employees: [{ id: 'e-anna' }], members: null, invites: null });
    expect(keys(rows)).toEqual([['card', null, 'e-anna', null, null]]);
  });
});
