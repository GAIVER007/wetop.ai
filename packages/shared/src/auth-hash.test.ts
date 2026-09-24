import { describe, expect, it } from 'vitest';

import { SessionSecretMissingError, hashEquals, hashSecret, newSessionToken } from './auth-hash';

const SECRET = 'секрет-для-проверки';

describe('отпечатки для входа', () => {
  it('одно и то же значение даёт один и тот же отпечаток', () => {
    expect(hashSecret('123456', SECRET)).toBe(hashSecret('123456', SECRET));
  });

  it('отпечаток не содержит самого значения', () => {
    expect(hashSecret('123456', SECRET)).not.toContain('123456');
  });

  it('шестнадцатеричная строка в 64 символа', () => {
    expect(hashSecret('123456', SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('разные коды — разные отпечатки', () => {
    expect(hashSecret('123456', SECRET)).not.toBe(hashSecret('123457', SECRET));
  });

  it('смена секрета меняет отпечаток: без секрета таблицу кодов не составить', () => {
    expect(hashSecret('123456', SECRET)).not.toBe(hashSecret('123456', 'другой секрет'));
  });

  it('без секрета — ошибка, а не тихий хэш без него', () => {
    const previous = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(() => hashSecret('123456')).toThrow(SessionSecretMissingError);
      expect(() => hashSecret('123456', '   ')).toThrow(SessionSecretMissingError);
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
    }
  });
});

describe('сравнение отпечатков', () => {
  it('одинаковые совпадают, разные нет', () => {
    const h = hashSecret('123456', SECRET);
    expect(hashEquals(h, h)).toBe(true);
    expect(hashEquals(h, hashSecret('654321', SECRET))).toBe(false);
  });

  it('разная длина не роняет сравнение', () => {
    expect(hashEquals('коротко', hashSecret('123456', SECRET))).toBe(false);
    expect(hashEquals('', '')).toBe(true);
  });
});

describe('ключ сессии', () => {
  it('каждый раз новый', () => {
    const keys = new Set(Array.from({ length: 100 }, () => newSessionToken()));
    expect(keys.size).toBe(100);
  });

  it('годится для заголовка и cookie: без символов, требующих экранирования', () => {
    expect(newSessionToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('длины хватает, чтобы не подбирался', () => {
    expect(newSessionToken().length).toBeGreaterThanOrEqual(42);
  });
});
