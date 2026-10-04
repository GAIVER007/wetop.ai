import { describe, expect, it } from 'vitest';
import {
  MEMBER_PHONE_MESSAGE,
  MEMBER_POSITION_MESSAGE,
  canEditMemberDetails,
  parseMemberDetails,
} from './members';

/** Телефон и должность сотрудника (TEAM2, Q-244, DATA_MODEL v2.10 §13.3) */
describe('parseMemberDetails', () => {
  it('телефон приводится к +E.164, должность чистится от лишних пробелов', () => {
    expect(
      parseMemberDetails({ phone: '8 (701) 555-44-33', position: '  Старший   администратор ' }),
    ).toEqual({ ok: true, phone: '+77015554433', position: 'Старший администратор' });
    expect(parseMemberDetails({ phone: '+998 90 123 45 67', position: 'Горничная' })).toEqual({
      ok: true,
      phone: '+998901234567',
      position: 'Горничная',
    });
  });

  it('пустое поле стирает значение; поля нет: тоже пусто', () => {
    expect(parseMemberDetails({ phone: '  ', position: '' })).toEqual({
      ok: true,
      phone: null,
      position: null,
    });
    expect(parseMemberDetails({})).toEqual({ ok: true, phone: null, position: null });
  });

  it('не телефон или слишком длинная должность: отказ словами', () => {
    expect(parseMemberDetails({ phone: '12-34', position: '' })).toEqual({
      ok: false,
      message: MEMBER_PHONE_MESSAGE,
    });
    expect(parseMemberDetails({ phone: 777, position: '' })).toEqual({
      ok: false,
      message: MEMBER_PHONE_MESSAGE,
    });
    expect(parseMemberDetails({ phone: '', position: 'я'.repeat(101) })).toEqual({
      ok: false,
      message: MEMBER_POSITION_MESSAGE,
    });
    expect(parseMemberDetails(null)).toEqual({ ok: true, phone: null, position: null });
  });
});

describe('canEditMemberDetails', () => {
  it('как отключение: владелец правит управляющих и администраторов, управляющий администраторов', () => {
    expect(canEditMemberDetails('OWNER', 'MANAGER', false)).toBe(true);
    expect(canEditMemberDetails('OWNER', 'STAFF', false)).toBe(true);
    expect(canEditMemberDetails('MANAGER', 'STAFF', false)).toBe(true);
    expect(canEditMemberDetails('MANAGER', 'MANAGER', false)).toBe(false);
    expect(canEditMemberDetails('MANAGER', 'OWNER', false)).toBe(false);
  });

  it('свои контакты правит тот, кому открыт раздел; администратор раздела не видит', () => {
    expect(canEditMemberDetails('OWNER', 'OWNER', true)).toBe(true);
    expect(canEditMemberDetails('MANAGER', 'MANAGER', true)).toBe(true);
    expect(canEditMemberDetails('STAFF', 'STAFF', true)).toBe(false);
    expect(canEditMemberDetails('STAFF', 'STAFF', false)).toBe(false);
  });
});
