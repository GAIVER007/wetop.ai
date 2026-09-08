import { describe, expect, it } from 'vitest';
import { anonymizeGuest, type GuestRecord } from './anonymize';

const g: GuestRecord = {
  exelyPersonId: 'P-1',
  firstName: 'Иван',
  lastName: 'Тестов',
  middleName: 'Петрович',
  birthDate: '1990-05-05',
  citizenship: 'KAZ',
  gender: 'MALE',
  email: 'ivan@example.invalid',
  phone: '+70000000001',
  notes: 'аллергия на орехи',
};
const salt = 'test-salt-not-secret';

describe('anonymizeGuest (ADR-018)', () => {
  it('replaces every personal field and keeps only what statistics need', () => {
    const a = anonymizeGuest(g, salt);
    for (const v of [
      'Иван',
      'Тестов',
      'Петрович',
      'ivan@example.invalid',
      '70000000001',
      'аллергия',
    ]) {
      expect(JSON.stringify(a)).not.toContain(v);
    }
    expect(a.exelyPersonId).toBe('P-1'); // ключ идемпотентности сохраняется
    expect(a.citizenship).toBe('KAZ');
    expect(a.gender).toBe('MALE');
    expect(a.birthDate).toBe('1990-01-01'); // год оставлен, день/месяц стёрты
    expect(a.notes).toBeNull();
    expect(a.firstName).toMatch(/^Гость$/);
    expect(a.lastName).toMatch(/^Тест-[0-9a-f]{6}$/);
    expect(a.email).toMatch(/^guest-[0-9a-f]{6}@example\.invalid$/);
    expect(a.phone).toMatch(/^\+7000\d{7}$/);
  });
  it('is deterministic for the same person and salt, and differs for another person', () => {
    expect(anonymizeGuest(g, salt)).toEqual(anonymizeGuest(g, salt));
    expect(anonymizeGuest({ ...g, exelyPersonId: 'P-2' }, salt).lastName).not.toBe(
      anonymizeGuest(g, salt).lastName,
    );
    expect(anonymizeGuest(g, 'other-salt').lastName).not.toBe(anonymizeGuest(g, salt).lastName);
  });
  it('handles missing fields without inventing values', () => {
    const a = anonymizeGuest(
      { ...g, middleName: null, email: null, phone: null, birthDate: null },
      salt,
    );
    expect(a.middleName).toBeNull();
    expect(a.email).toBeNull();
    expect(a.phone).toBeNull();
    expect(a.birthDate).toBeNull();
  });
});
