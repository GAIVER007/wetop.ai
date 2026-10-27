import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_LOCK_ATTEMPTS, MAX_FAILED_ATTEMPTS } from '@pms/domain';
import { AuthService } from './auth.service';
import { loginGuard } from './login-guard';
import { EmailVerificationService } from './email-verification.service';
import { fakeDb, fakeUser } from './fake-db';

/**
 * Владелец 27.10.2026: главный администратор салона ввёл пароль неверно 5 раз, и вход запирался на 15 минут для всех.
 * Посторонний мог так же запирать чужой вход, просто вводя неверный пароль. Теперь замок 5 ошибок ставится на пару
 * «почта + адрес устройства»: подбирающий заперт, хозяин учётки со своего устройства входит. Вся учётка запирается
 * только при массовом подборе с многих адресов.
 */
const PASSWORD = 'luxx-stoika-2026';
const NOW = new Date('2026-10-27T10:00:00Z');
const EMAIL = 'admin@example.invalid';
const ATTACKER = '203.0.113.7';
const OWNER = '198.51.100.20';

function service() {
  loginGuard.clearAll();
  const world = fakeDb([fakeUser()]);
  const mailer = { async send() {} };
  return { auth: new AuthService(world.prisma, new EmailVerificationService(world.prisma, mailer, 'https://app.wetop.ai')), ...world };
}
const miss = (auth: AuthService, ip: string, at = NOW) =>
  auth.login({ email: EMAIL, password: 'не тот', ip }, at).catch((e: Error) => e.message);

describe('замок входа по устройству', () => {
  it('5 ошибок с одного адреса запирают этот адрес, а хозяин с другого адреса входит', async () => {
    const { auth, users } = service();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) await miss(auth, ATTACKER);
    // с адреса подбора даже верный пароль не пускает
    await expect(auth.login({ email: EMAIL, password: PASSWORD, ip: ATTACKER }, NOW)).rejects.toThrow(/Неверная почта или пароль/);
    // учётка целиком не заперта
    expect(users[0]!.lockedUntil).toBeNull();
    await expect(auth.login({ email: EMAIL, password: PASSWORD, ip: OWNER }, NOW)).resolves.toMatchObject({ user: { email: EMAIL } });
  });
  it('через 15 минут адрес снова может пробовать', async () => {
    const { auth } = service();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) await miss(auth, ATTACKER);
    const later = new Date(NOW.getTime() + 15 * 60_000 + 1);
    await expect(auth.login({ email: EMAIL, password: PASSWORD, ip: ATTACKER }, later)).resolves.toMatchObject({ user: { email: EMAIL } });
  });
  it('успешный вход с адреса обнуляет его счёт ошибок', async () => {
    const { auth } = service();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) await miss(auth, OWNER);
    await auth.login({ email: EMAIL, password: PASSWORD, ip: OWNER }, NOW);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) await miss(auth, OWNER);
    await expect(auth.login({ email: EMAIL, password: PASSWORD, ip: OWNER }, NOW)).resolves.toMatchObject({ user: { email: EMAIL } });
  });
  it(`массовый подбор с многих адресов: после ${ACCOUNT_LOCK_ATTEMPTS} ошибок запирается вся учётка`, async () => {
    const { auth, users } = service();
    expect(ACCOUNT_LOCK_ATTEMPTS).toBeGreaterThan(MAX_FAILED_ATTEMPTS);
    for (let i = 0; i < ACCOUNT_LOCK_ATTEMPTS; i += 1) await miss(auth, `192.0.2.${i + 1}`);
    expect(users[0]!.lockedUntil).not.toBeNull();
  });
  it('сброс пароля по ссылке снимает замок адреса', async () => {
    const { auth } = service();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) await miss(auth, OWNER);
    loginGuard.clearEmail(EMAIL);
    await expect(auth.login({ email: EMAIL, password: PASSWORD, ip: OWNER }, NOW)).resolves.toMatchObject({ user: { email: EMAIL } });
  });
  it('текст ошибки подсказывает раскладку и «Забыли пароль?» и не выдаёт, есть ли такая почта', async () => {
    const { auth } = service();
    const known = await miss(auth, OWNER);
    const unknown = await auth.login({ email: 'nikogo@example.invalid', password: 'x', ip: OWNER }, NOW).catch((e: Error) => e.message);
    expect(known).toBe(unknown);
    expect(known).toMatch(/Caps Lock/);
    expect(known).toMatch(/Забыли пароль/);
  });
});
