import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  VERIFY_CODE_BAD_MESSAGE,
  VERIFY_CODE_EXPIRED_MESSAGE,
  VERIFY_CODE_LOCKED_MESSAGE,
  normalizeVerificationCode,
} from '@pms/domain';
import { EmailVerificationService, newVerificationCode } from './email-verification.service';
import { fakeDb, fakeUser } from './fake-db';

/**
 * Код из письма при регистрации (решение владельца 22.10.2026: «код вместо ссылки, ссылку оставить в том же письме
 * как запасной вариант»). Почта и коды вымышленные.
 */
const APP = 'https://app.wetop.ai';
const NOW = new Date('2026-10-22T10:00:00Z');
const EMAIL = 'new-owner@example.invalid';
const later = (ms: number) => new Date(NOW.getTime() + ms);

function setup(codes = ['204815', '771203', '550091']) {
  const world = fakeDb([fakeUser({ id: 'u-new', email: EMAIL, emailVerifiedAt: null })]);
  const letters: Array<{ to: string; subject: string; text: string }> = [];
  const service = new EmailVerificationService(
    world.prisma,
    { async send(letter: { to: string; subject: string; text: string }) { letters.push(letter); } },
    APP,
  );
  const queue = [...codes];
  service.codeSource = () => queue.shift() ?? '000000';
  return { ...world, service, letters };
}

const send = (s: ReturnType<typeof setup>, at = NOW) =>
  s.service.sendFor({ userId: 'u-new', email: EMAIL, name: 'Айгерим' }, at);

describe('письмо подтверждения: код и запасная ссылка', () => {
  it('одно письмо содержит код в теме и в тексте и прежнюю ссылку', async () => {
    const s = setup();
    expect(await send(s)).toBe(true);
    expect(s.letters).toHaveLength(1);
    const [letter] = s.letters;
    expect(letter!.subject).toContain('204815');
    expect(letter!.text).toContain('204815');
    expect(letter!.text).toContain('15 минут');
    expect(letter!.text).toMatch(/https:\/\/app\.wetop\.ai\/login\/verify\?token=\S+/);
  });

  it('в базе нет кода открытым текстом: только отпечаток', async () => {
    const s = setup();
    await send(s);
    expect(s.verifications).toHaveLength(2);
    for (const row of s.verifications) expect(row.tokenHash).not.toContain('204815');
  });
});

describe('подтверждение кодом', () => {
  it('верный код подтверждает почту, отдаёт организацию и гасит ссылку того же письма', async () => {
    const s = setup();
    await send(s);
    const link = s.letters[0]!.text.match(/token=(\S+)/)![1]!;
    const result = await s.service.confirmCode({ email: EMAIL, code: '204 815' }, later(60_000));
    expect(result).toEqual({ userId: 'u-new', organizationId: expect.any(String) });
    expect(s.users[0]!.emailVerifiedAt).toEqual(later(60_000));
    expect(s.verifications.every((r) => r.usedAt !== null)).toBe(true);
    expect(s.audit.at(-1)).toMatchObject({ action: 'user.email.verified', after: { method: 'code' } });
    // ссылку из того же письма код погасил: после окна повтора (10 минут, ADR-095) она уже не впускает
    await expect(s.service.confirm(decodeURIComponent(link), later(12 * 60_000))).rejects.toThrow();
  });

  it('код одноразовый: второй ввод того же кода не впускает', async () => {
    const s = setup();
    await send(s);
    await s.service.confirmCode({ email: EMAIL, code: '204815' }, later(1_000));
    await expect(s.service.confirmCode({ email: EMAIL, code: '204815' }, later(2_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
  });

  it('неверный код: понятный отказ, почта не подтверждена', async () => {
    const s = setup();
    await send(s);
    await expect(s.service.confirmCode({ email: EMAIL, code: '111111' }, later(1_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
    expect(s.users[0]!.emailVerifiedAt).toBeNull();
  });

  it('через 15 минут код истёк, а ссылка из письма ещё работает', async () => {
    const s = setup();
    await send(s);
    await expect(
      s.service.confirmCode({ email: EMAIL, code: '204815' }, later(15 * 60_000 + 1)),
    ).rejects.toThrow(VERIFY_CODE_EXPIRED_MESSAGE);
    const link = s.letters[0]!.text.match(/token=(\S+)/)![1]!;
    await expect(s.service.confirm(decodeURIComponent(link), later(16 * 60_000))).resolves.toMatchObject({
      userId: 'u-new',
    });
  });

  it('пять неверных кодов гасят код в базе: шестая попытка верным кодом не проходит, ссылка остаётся', async () => {
    const s = setup();
    await send(s);
    for (let i = 1; i <= 4; i++)
      await expect(
        s.service.confirmCode({ email: EMAIL, code: `00000${i}` }, later(i * 1_000)),
      ).rejects.toThrow(VERIFY_CODE_BAD_MESSAGE);
    await expect(s.service.confirmCode({ email: EMAIL, code: '000005' }, later(5_000))).rejects.toThrow(
      VERIFY_CODE_LOCKED_MESSAGE,
    );
    await expect(s.service.confirmCode({ email: EMAIL, code: '204815' }, later(6_000))).rejects.toThrow(
      VERIFY_CODE_LOCKED_MESSAGE,
    );
    expect(s.users[0]!.emailVerifiedAt).toBeNull();
    // погашен именно код (15 минут), ссылка на 72 часа жива
    const alive = s.verifications.filter((r) => r.usedAt === null);
    expect(alive).toHaveLength(1);
    expect(alive[0]!.expiresAt.getTime() - NOW.getTime()).toBe(72 * 3_600_000);
  });

  it('погашенный код не оживает после перезапуска API: новый сервис на той же базе тоже отказывает', async () => {
    const s = setup();
    await send(s);
    for (let i = 1; i <= 5; i++)
      await s.service.confirmCode({ email: EMAIL, code: `00000${i}` }, later(i * 1_000)).catch(() => null);
    const restarted = new EmailVerificationService(s.prisma, null, APP);
    await expect(restarted.confirmCode({ email: EMAIL, code: '204815' }, later(7_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
  });

  it('новое письмо даёт новый код, прежний перестаёт работать, счёт ошибок начинается заново', async () => {
    const s = setup();
    await send(s);
    for (let i = 1; i <= 3; i++)
      await s.service.confirmCode({ email: EMAIL, code: `00000${i}` }, later(i * 1_000)).catch(() => null);
    await send(s, later(61_000));
    expect(s.letters).toHaveLength(2);
    expect(s.letters[1]!.subject).toContain('771203');
    await expect(
      s.service.confirmCode({ email: EMAIL, code: '204815' }, later(62_000)),
    ).rejects.toThrow(VERIFY_CODE_BAD_MESSAGE);
    for (let i = 4; i <= 6; i++)
      await s.service.confirmCode({ email: EMAIL, code: `00000${i}` }, later(62_000 + i)).catch(() => null);
    await expect(s.service.confirmCode({ email: EMAIL, code: '771203' }, later(63_000))).resolves.toMatchObject({
      userId: 'u-new',
    });
  });

  it('неизвестная почта и чужой код дают тот же ответ, что неверный код', async () => {
    const s = setup();
    await send(s);
    await expect(
      s.service.confirmCode({ email: 'nobody@example.invalid', code: '204815' }, later(1_000)),
    ).rejects.toThrow(VERIFY_CODE_BAD_MESSAGE);
    await expect(s.service.confirmCode({ email: 'не почта', code: '204815' }, later(1_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
    await expect(s.service.confirmCode({ email: EMAIL, code: '20481' }, later(1_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
  });

  it('заблокированный человек кодом не входит', async () => {
    const s = setup();
    await send(s);
    s.users[0]!.status = 'BLOCKED';
    await expect(s.service.confirmCode({ email: EMAIL, code: '204815' }, later(1_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
    expect(s.users[0]!.emailVerifiedAt).toBeNull();
  });

  it('уже подтверждённая почта кодом повторно не впускает', async () => {
    const s = setup();
    await send(s);
    s.users[0]!.emailVerifiedAt = NOW;
    await expect(s.service.confirmCode({ email: EMAIL, code: '204815' }, later(1_000))).rejects.toThrow(
      VERIFY_CODE_BAD_MESSAGE,
    );
  });
});

describe('форма кода', () => {
  it('генератор даёт ровно шесть цифр, с ведущими нулями', () => {
    for (let i = 0; i < 200; i++) expect(newVerificationCode()).toMatch(/^\d{6}$/);
  });
  it.each([
    ['204815', '204815'],
    [' 204 815 ', '204815'],
    ['204-815', '204815'],
    ['20481', null],
    ['2048150', null],
    ['20481a', null],
  ])('«%s» читается как %s', (raw, expected) => {
    expect(normalizeVerificationCode(raw)).toBe(expected);
  });
});
