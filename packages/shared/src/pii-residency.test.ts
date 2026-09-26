import { describe, expect, it } from 'vitest';
import {
  AnonymizeSaltMissingError,
  deskGuestForStorage,
  freeTextForStorage,
  guestForStorage,
  maskContacts,
  piiStorageMode,
  pseudonymSalt,
  realPiiAllowed,
  withoutGuestIdentity,
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

  it('контакт из пробелов — это «нет контакта»: псевдоним не выдумывает телефон и почту', () => {
    // Channex и Exely присылают пустые поля строкой; '   ' истинна в JS — ровно дефект гражданства 12.09
    const stored = guestForStorage(
      { firstName: 'A', lastName: 'B', phone: '   ', email: ' ' },
      'BDC-4',
      env(),
    );
    expect(stored.phone).toBeNull();
    expect(stored.email).toBeNull();
  });

  it('в боевом режиме пустой контакт хранится как NULL, а не пустой строкой; края обрезаются', () => {
    const real = env({ PII_STORAGE: 'real' });
    const blank = guestForStorage(
      { firstName: 'A', lastName: 'B', phone: '', email: '  ' },
      'X',
      real,
    );
    expect(blank.phone).toBeNull();
    expect(blank.email).toBeNull();
    const padded = guestForStorage(
      { firstName: 'A', lastName: 'B', phone: ' +77011234567 ', email: ' ivan@example.invalid ' },
      'X',
      real,
    );
    expect(padded).toMatchObject({ phone: '+77011234567', email: 'ivan@example.invalid' });
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

describe('гость, введённый стойкой руками (ADR-072)', () => {
  const typed = {
    firstName: ' Ivan ',
    lastName: 'Petrov',
    middleName: 'Sergeevich',
    phone: '+77011234567',
    email: 'ivan@example.invalid',
  };

  it('пока база не в Казахстане — «Гость Стойка-…» без отчества и контактов; соль не нужна', () => {
    const stored = deskGuestForStorage(typed, {});
    expect(stored.firstName).toBe('Гость');
    expect(stored.lastName).toMatch(/^Стойка-[0-9a-f]{6}$/);
    expect(stored).toMatchObject({ middleName: null, phone: null, email: null });
    expect(JSON.stringify(stored)).not.toMatch(/Ivan|Petrov|Sergeevich|7011234567|ivan@/);
    expect(piiStorageMode({})).toBe('pseudonymized');
  });

  it('имя не обязательно: форма в этом режиме его не спрашивает', () => {
    expect(deskGuestForStorage({}, {}).lastName).toMatch(/^Стойка-/);
  });

  it('два ручных гостя — два разных псевдонима: у ручного ввода нет ключа брони канала', () => {
    expect(deskGuestForStorage(typed, {}).lastName).not.toBe(
      deskGuestForStorage(typed, {}).lastName,
    );
  });

  it('PII_STORAGE=real — как введено: края обрезаны, пустое — NULL', () => {
    const real = { PII_STORAGE: 'real' };
    expect(deskGuestForStorage({ ...typed, phone: '  ', email: '' }, real)).toEqual({
      firstName: 'Ivan',
      lastName: 'Petrov',
      middleName: 'Sergeevich',
      phone: null,
      email: null,
    });
    expect(piiStorageMode(real)).toBe('real');
  });
});

/** Q-169: почта и телефоны в свободном тексте (заметка брони, комментарий гостя, текст ошибки) */
describe('maskContacts, freeTextForStorage', () => {
  it('маскирует почту и телефоны: местные, международные, со скобками и дефисами', () => {
    expect(
      maskContacts(
        'звонить +7 701 234 56 78, 8 (777) 123-45-67 или 87012345678; London +44 20 7946 0958; guest.test@example.com',
      ),
    ).toBe('звонить <телефон>, <телефон> или <телефон>; London <телефон>; <почта>');
  });

  it('номера броней, даты, суммы и время не трогает', () => {
    const text = 'бронь 20260912-ABC123, BDC-9996013801, код 9996013801, заезд 2026-11-10 в 14:00, доплата 5 000 ₸';
    expect(maskContacts(text)).toBe(text);
  });

  it('пока база не в РК — текст с маской; PII_STORAGE=real — как введён; пусто остаётся пустым', () => {
    const note = 'перезвонить +7 701 234 56 78';
    expect(freeTextForStorage(note, {})).toBe('перезвонить <телефон>');
    expect(freeTextForStorage(note, { PII_STORAGE: 'real' })).toBe(note);
    expect(freeTextForStorage(null, {})).toBeNull();
    expect(freeTextForStorage(undefined, {})).toBeNull();
  });
});

// Аудит 26.09, С-38: выражение почты без якоря перебирало каждую позицию длинного слова — квадратичная работа. Заметка
// в 100 КБ маскировалась секунды, причём в создании брони — уже под блокировкой категорий.
describe('маска контактов и длинный текст', () => {
  it('100 КБ одного слова маскируются быстро', () => {
    const started = performance.now();
    maskContacts('a'.repeat(100_000));
    const ms = performance.now() - started;
    expect(ms, `маска заняла ${Math.round(ms)} мс`).toBeLessThan(200);
  });
});

// Аудит 26.09, С-40: маска пропускала частые формы — «701 234 56 78» и «7011234567» без восьмёрки, ИИН и почту на
// кириллице. Номера броней, суммы и даты должны остаться как были.
describe('маска контактов: пропущенные формы', () => {
  it.each([
    ['звонить 701 234 56 78 после обеда', 'звонить <телефон> после обеда'],
    ['номер 7011234567', 'номер <телефон>'],
    ['тел. (777) 123-45-67', 'тел. <телефон>'],
    ['ИИН 900101300017 для договора', 'ИИН <ИИН> для договора'],
    ['почта иван.тестов@почта.рф', 'почта <почта>'],
  ])('«%s»', (raw, masked) => {
    expect(maskContacts(raw)).toBe(masked);
  });

  it.each([
    'бронь BDC-4123456789 от канала',
    'бронь 20260912-ABC123',
    'сумма 12 500 000 тиын',
    'даты 2026-09-12 — 2026-09-15',
    'номер 900101300014 — не ИИН: контрольная цифра не сходится',
  ])('не трогает «%s»', (text) => {
    expect(maskContacts(text)).toBe(text);
  });
});

// Аудит 25.09, В-5: карточка брони уходила в журнал целиком — имя и телефон основного гостя, имена гостей проживаний.
// Пока база не в РК, это псевдонимы; после переезда и «журнал только дописывается» (ADR-082) настоящие ФИО и телефоны
// стали бы в журнале неудаляемыми. У гостя в журнале остаются только id, гражданство и признак основного.
describe('данные гостя для журнала', () => {
  it('имя и контакты гостя не попадают в журнал ни на каком уровне', () => {
    const card = {
      confirmationNumber: '20260926-TEST01',
      notes: 'поздний заезд',
      primaryGuest: { id: 'g1', label: 'Айгерим Тестова', citizenship: 'KAZ', phone: '+77011234567' },
      items: [{ id: 'i1', guests: [{ label: 'Айгерим Тестова', isPrimary: true }] }],
    };
    const safe = withoutGuestIdentity({ before: card, after: { ...card, status: 'CANCELLED' } });
    const text = JSON.stringify(safe);
    expect(text).not.toContain('Тестова');
    expect(text).not.toContain('7011234567');
    expect(safe).toMatchObject({
      before: {
        confirmationNumber: '20260926-TEST01',
        notes: 'поздний заезд',
        primaryGuest: { id: 'g1', citizenship: 'KAZ' },
        items: [{ id: 'i1', guests: [{ isPrimary: true }] }],
      },
      after: { status: 'CANCELLED' },
    });
  });

  it('значения без гостя проходят как есть', () => {
    expect(withoutGuestIdentity(null)).toBeNull();
    expect(withoutGuestIdentity({ amountMinor: '100', ids: ['a'] })).toEqual({ amountMinor: '100', ids: ['a'] });
  });

  // Проверка исправлений 26.09: заметка брони (замечания гостя из канала, комментарий с сайта) и причина возврата шли в
  // журнал как есть — при PII_STORAGE=real с телефоном и почтой, в журнал, который только дописывается
  it('свободный текст в журнале — с маской контактов, даже когда база хранит настоящие данные', () => {
    const safe = withoutGuestIdentity({
      after: { notes: 'Гость просит позвонить +7 701 555 12 34, почта ivan@example.invalid', reason: 'вернуть на 87015551234' },
    }) as { after: { notes: string; reason: string } };
    expect(safe.after.notes).not.toMatch(/555|ivan@/);
    expect(safe.after.notes).toContain('Гость просит позвонить');
    expect(safe.after.reason).not.toContain('87015551234');
  });
});

