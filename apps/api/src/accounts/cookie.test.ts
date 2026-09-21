import { describe, expect, it } from 'vitest';

import { SESSION_COOKIE, cookieOptions, sessionFromCookieHeader } from './cookie';

describe('кука сессии: разбор', () => {
  it('берёт свою и не путает с чужими', () => {
    expect(sessionFromCookieHeader(`a=1; ${SESSION_COOKIE}=КЛЮЧ; b=2`)).toBe('КЛЮЧ');
  });

  it('единственная кука тоже читается', () => {
    expect(sessionFromCookieHeader(`${SESSION_COOKIE}=КЛЮЧ`)).toBe('КЛЮЧ');
  });

  it('заголовка нет или пуст — ключа нет', () => {
    expect(sessionFromCookieHeader(undefined)).toBeNull();
    expect(sessionFromCookieHeader('')).toBeNull();
    expect(sessionFromCookieHeader('a=1; b=2')).toBeNull();
  });

  it('пустое значение — это не ключ', () => {
    expect(sessionFromCookieHeader(`${SESSION_COOKIE}=`)).toBeNull();
  });

  it('значение с процентами разворачивается', () => {
    expect(sessionFromCookieHeader(`${SESSION_COOKIE}=a%2Fb`)).toBe('a/b');
  });

  it('кука, чьё имя начинается так же, не подходит', () => {
    expect(sessionFromCookieHeader(`${SESSION_COOKIE}_old=ЧУЖОЕ`)).toBeNull();
  });
});

describe('кука сессии: признаки', () => {
  it('на боевом адресе — Secure и домен второго уровня, чтобы app и api видели одну куку', () => {
    expect(cookieOptions({ APP_URL: 'https://app.wetop.ai' }, 100)).toEqual({
      domain: '.wetop.ai',
      secure: true,
      maxAgeSeconds: 100,
    });
  });

  it('в разработке по http признак Secure снимается — иначе кука не доедет', () => {
    expect(cookieOptions({ APP_URL: 'http://localhost:3000' }, 100)).toEqual({
      secure: false,
      maxAgeSeconds: 100,
    });
  });

  it('без APP_URL кука привязывается к хосту API, а не падает', () => {
    expect(cookieOptions({}, 100)).toEqual({ secure: false, maxAgeSeconds: 100 });
  });

  it('мусор вместо адреса не роняет сборку', () => {
    expect(cookieOptions({ APP_URL: 'не адрес' }, 100)).toEqual({ secure: false, maxAgeSeconds: 100 });
  });
});
