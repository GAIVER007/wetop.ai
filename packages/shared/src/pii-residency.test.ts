import { describe, expect, it } from 'vitest';
import {
  AnonymizeSaltMissingError,
  guestForStorage,
  pseudonymSalt,
  realPiiAllowed,
} from './pii-residency';

/** ADR-009/ADR-018: настоящие ПД только в production-БД в Казахстане. Гости вымышленные (ADR-010). */
const guest = {
  firstName: 'Ivan',
  lastName: 'Petrov',
  phone: '+77011234567',
  email: 'ivan@example.invalid',
};
const env = (over: Record<string, string> = {}) => ({ ANONYMIZE_SALT: 'salt-a', ...over });

describe('где можно хранить настоящие данные гостя', () => {
  it('по умолчанию гость канала записывается псевдонимом: ни имени, ни телефона, ни почты', () => {
    const stored = guestForStorage(guest, 'BDC-1', env());
    expect(stored.lastName).not.toContain('Petrov');
    expect(stored.firstName).toBe('Гость');
    expect(stored.phone).not.toBe(guest.phone);
    expect(stored.email).not.toBe(guest.email);
    expect(stored.email).toMatch(/@example\.invalid$/);
  });

  it('псевдоним детерминирован по ключу брони: повтор ревизии не создаёт второго гостя', () => {
    expect(guestForStorage(guest, 'BDC-1', env())).toEqual(guestForStorage(guest, 'BDC-1', env()));
    expect(guestForStorage(guest, 'BDC-2', env()).lastName).not.toBe(
      guestForStorage(guest, 'BDC-1', env()).lastName,
    );
  });

  it('другая соль — другой псевдоним: по известной соли значение не подобрать', () => {
    expect(guestForStorage(guest, 'BDC-1', env({ ANONYMIZE_SALT: 'salt-b' })).lastName).not.toBe(
      guestForStorage(guest, 'BDC-1', env()).lastName,
    );
  });

  it('пустой телефон и почта остаются пустыми, а не превращаются в выдуманные', () => {
    const stored = guestForStorage({ firstName: 'A', lastName: 'B' }, 'BDC-3', env());
    expect(stored.phone).toBeNull();
    expect(stored.email).toBeNull();
  });

  it('настоящие данные проходят только при PII_STORAGE=real', () => {
    expect(realPiiAllowed(env())).toBe(false);
    const stored = guestForStorage(guest, 'BDC-1', env({ PII_STORAGE: 'real' }));
    expect(stored).toMatchObject({ firstName: 'Ivan', lastName: 'Petrov', phone: guest.phone });
  });

  it('без соли — отказ с инструкцией, а не тихая запись предсказуемого псевдонима', () => {
    expect(() => pseudonymSalt({})).toThrow(AnonymizeSaltMissingError);
    expect(() => guestForStorage(guest, 'BDC-1', {})).toThrow(/ANONYMIZE_SALT/);
  });

  it('запасной вариант соли — уже заданный ключ шифрования ПД', () => {
    expect(pseudonymSalt({ PII_ENCRYPTION_KEY: 'k' })).toBe('k');
    expect(pseudonymSalt({ ANONYMIZE_SALT: 's', PII_ENCRYPTION_KEY: 'k' })).toBe('s');
  });
});
