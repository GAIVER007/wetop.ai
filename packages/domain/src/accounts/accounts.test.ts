import { describe, expect, it } from 'vitest';
import {
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  SESSION_HOURS,
  checkPassword,
  evaluateLogin,
  hashPassword,
  hashSessionToken,
  newSessionToken,
  validEmail,
  sessionState,
  verifyPassword,
} from './index';

describe('validEmail', () => {
  it('приводит к нижнему регистру и убирает пробелы по краям', () => {
    expect(validEmail('  Admin@Luxx.KZ ')).toBe('admin@luxx.kz');
  });

  it('отвергает то, что не похоже на почту', () => {
    expect(validEmail('admin')).toBeNull();
    expect(validEmail('')).toBeNull();
    expect(validEmail('a@b')).toBeNull();
    expect(validEmail('два@слова.kz с пробелом')).toBeNull();
  });
});

describe('checkPassword', () => {
  it('короткий пароль не принимается', () => {
    expect(checkPassword('1234567')).toMatchObject({ ok: false });
  });

  it('пароль из одних цифр не принимается', () => {
    expect(checkPassword('12345678901')).toMatchObject({ ok: false });
  });

  it('обычный рабочий пароль принимается', () => {
    expect(checkPassword('luxx-stoika-2026')).toEqual({ ok: true });
  });

  it('пробелы по краям не считаются длиной', () => {
    expect(checkPassword('   abc    ')).toMatchObject({ ok: false });
  });
});

describe('hashPassword и verifyPassword', () => {
  it('хеш не содержит самого пароля и узнаёт его обратно', () => {
    const hash = hashPassword('luxx-stoika-2026');
    expect(hash).not.toContain('luxx-stoika-2026');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('luxx-stoika-2026', hash)).toBe(true);
    expect(verifyPassword('luxx-stoika-2027', hash)).toBe(false);
  });

  it('два пользователя с одним паролем получают разные хеши — соль своя у каждого', () => {
    expect(hashPassword('luxx-stoika-2026')).not.toBe(hashPassword('luxx-stoika-2026'));
  });

  it('испорченный хеш не пускает и не роняет проверку', () => {
    expect(verifyPassword('luxx-stoika-2026', 'мусор')).toBe(false);
    expect(verifyPassword('luxx-stoika-2026', 'scrypt$1$2$3$4$5')).toBe(false);
    expect(verifyPassword('luxx-stoika-2026', '')).toBe(false);
  });
});

const now = new Date('2026-09-15T10:00:00Z');
const user = (over: Partial<Parameters<typeof evaluateLogin>[0]['user']> = {}) => ({
  status: 'ACTIVE' as const,
  passwordHash: hashPassword('luxx-stoika-2026'),
  failedAttempts: 0,
  lockedUntil: null,
  ...over,
});

describe('evaluateLogin', () => {
  it('верный пароль пускает и сбрасывает счётчик', () => {
    expect(evaluateLogin({ user: user({ failedAttempts: 3 }), password: 'luxx-stoika-2026', now })).toEqual({
      outcome: 'ok',
      failedAttempts: 0,
      lockedUntil: null,
    });
  });

  it('неверный пароль считает попытку, но не говорит, что не так', () => {
    expect(evaluateLogin({ user: user(), password: 'не тот', now })).toEqual({
      outcome: 'wrong',
      failedAttempts: 1,
      lockedUntil: null,
      resetCounter: false,
    });
  });

  it('после истёкшего замка первая ошибка считается первой, а не шестой (аудит 26.09, С-6)', () => {
    const result = evaluateLogin({
      user: user({
        failedAttempts: MAX_FAILED_ATTEMPTS,
        lockedUntil: new Date(now.getTime() - 60_000),
      }),
      password: 'не тот',
      now,
    });
    expect(result).toMatchObject({ outcome: 'wrong', failedAttempts: 1, lockedUntil: null, resetCounter: true });
  });

  it(`после ${MAX_FAILED_ATTEMPTS} промахов вход запирается на ${LOCK_MINUTES} минут`, () => {
    const result = evaluateLogin({
      user: user({ failedAttempts: MAX_FAILED_ATTEMPTS - 1 }),
      password: 'не тот',
      now,
    });
    expect(result.outcome).toBe('wrong');
    expect(result.lockedUntil).toEqual(new Date(now.getTime() + LOCK_MINUTES * 60_000));
  });

  it('пока заперто, верный пароль тоже не пускает', () => {
    const lockedUntil = new Date(now.getTime() + 60_000);
    expect(
      evaluateLogin({ user: user({ lockedUntil, failedAttempts: 5 }), password: 'luxx-stoika-2026', now }),
    ).toMatchObject({ outcome: 'locked' });
  });

  it('когда запрет истёк, верный пароль снова пускает', () => {
    const lockedUntil = new Date(now.getTime() - 1_000);
    expect(
      evaluateLogin({ user: user({ lockedUntil, failedAttempts: 5 }), password: 'luxx-stoika-2026', now }),
    ).toEqual({ outcome: 'ok', failedAttempts: 0, lockedUntil: null });
  });

  it('заблокированного не пускает даже с верным паролем', () => {
    expect(
      evaluateLogin({ user: user({ status: 'BLOCKED' }), password: 'luxx-stoika-2026', now }),
    ).toMatchObject({ outcome: 'blocked' });
  });

  it('человека без пароля по паролю не пускает: он войдёт другим способом, когда тот появится', () => {
    expect(evaluateLogin({ user: user({ passwordHash: '' }), password: 'что угодно', now })).toMatchObject({
      outcome: 'wrong',
    });
  });

  it('пользователя без пароля не пускает с пустым паролем', () => {
    expect(evaluateLogin({ user: user({ passwordHash: '' }), password: '', now })).toMatchObject({
      outcome: 'wrong',
    });
  });
});

describe('токен сессии', () => {
  it('токен каждый раз новый и достаточно длинный', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('в базу идёт хеш, не токен', () => {
    const token = newSessionToken();
    const stored = hashSessionToken(token);
    expect(stored).not.toBe(token);
    expect(stored).toHaveLength(64);
    expect(hashSessionToken(token)).toBe(stored);
  });
});

describe('sessionState', () => {
  const fresh = { expiresAt: new Date(now.getTime() + 3_600_000), revokedAt: null };

  it('живая сессия пускает', () => {
    expect(sessionState(fresh, now)).toBe('active');
  });

  it('просроченная не пускает', () => {
    expect(sessionState({ ...fresh, expiresAt: new Date(now.getTime() - 1) }, now)).toBe('expired');
  });

  it('отозванная не пускает, даже если срок не вышел', () => {
    expect(sessionState({ ...fresh, revokedAt: now }, now)).toBe('revoked');
  });

  it(`срок сессии — ${SESSION_HOURS} часов от входа`, () => {
    expect(SESSION_HOURS).toBe(12);
  });
});
