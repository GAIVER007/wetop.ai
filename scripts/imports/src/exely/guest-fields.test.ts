import { describe, expect, it } from 'vitest';
import { guestCitizenshipOnUpdate } from './guest-fields';

/**
 * Q-118: гражданство — поле заселения, а не импорта (DATA_MODEL §3). У броней каналов Exely его не отдаёт,
 * код с паспорта вводит стойка. Повторная синхронизация суток не должна стирать введённое.
 */
describe('guestCitizenshipOnUpdate', () => {
  it('пустое из Exely не попадает в update — введённое стойкой остаётся в базе', () => {
    // undefined = поля нет в update: что лежит в PMS, то и остаётся
    expect(guestCitizenshipOnUpdate(null)).toBeUndefined();
    expect(guestCitizenshipOnUpdate('')).toBeUndefined();
    expect(guestCitizenshipOnUpdate('   ')).toBeUndefined();
  });
  it('код из Exely пишется: с пробелами и в нижнем регистре — приводится к alpha-3', () => {
    expect(guestCitizenshipOnUpdate('KAZ')).toBe('KAZ');
    expect(guestCitizenshipOnUpdate(' kaz ')).toBe('KAZ');
  });
  it('Exely остаётся источником истины, пока присылает код', () => {
    expect(guestCitizenshipOnUpdate('RUS')).toBe('RUS');
    expect(guestCitizenshipOnUpdate('KAZ')).toBe('KAZ');
  });
  it('поля вовсе нет — писать нечего', () => {
    expect(guestCitizenshipOnUpdate(undefined)).toBeUndefined();
  });
});
