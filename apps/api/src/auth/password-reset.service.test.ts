import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { hashSessionToken, verifyPassword } from '@pms/domain';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { fakeDb, fakeUser } from './fake-db';

const NOW = new Date('2026-09-15T10:00:00Z');
const APP = 'https://app.wetop.ai';

function sent() {
  const letters: Array<{ to: string; subject: string; text: string }> = [];
  return {
    letters,
    mailer: {
      async send(letter: { to: string; subject: string; text: string }) {
        letters.push(letter);
        return { id: `mail-${letters.length}` };
      },
    },
  };
}

function service(users = [fakeUser()], mailer: unknown = sent().mailer) {
  const world = fakeDb(users);
  return {
    ...world,
    reset: new PasswordResetService(world.prisma, mailer as never, APP),
    auth: new AuthService(
      world.prisma,
      new EmailVerificationService(world.prisma, mailer as never, APP),
    ),
  };
}

describe('PasswordResetService.request', () => {
  it('шлёт письмо со ссылкой и кладёт в базу только хеш токена', async () => {
    const box = sent();
    const { reset, resets } = service([fakeUser()], box.mailer);

    await reset.request('admin@example.invalid', NOW);

    expect(box.letters).toHaveLength(1);
    expect(box.letters[0]!.to).toBe('admin@example.invalid');
    expect(box.letters[0]!.subject).toBe('WETOP: смена пароля');

    const link = box.letters[0]!.text.match(/https:\/\/\S+/)?.[0] ?? '';
    const token = new URL(link).searchParams.get('token') ?? '';
    expect(token).not.toBe('');
    expect(resets).toHaveLength(1);
    expect(resets[0]!.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(resets)).not.toContain(token);
  });

  it('незнакомая почта: письма нет, но и наружу это не видно', async () => {
    const box = sent();
    const { reset, resets } = service([fakeUser()], box.mailer);
    await expect(reset.request('нет-такой@example.invalid', NOW)).resolves.toBeUndefined();
    expect(box.letters).toHaveLength(0);
    expect(resets).toHaveLength(0);
  });

  it('заблокированному сотруднику ссылку не отправляем', async () => {
    const box = sent();
    const { reset } = service([fakeUser({ status: 'BLOCKED' })], box.mailer);
    await reset.request('admin@example.invalid', NOW);
    expect(box.letters).toHaveLength(0);
  });

  it('второе письмо на ту же почту не уходит чаще раза в пять минут', async () => {
    const box = sent();
    const { reset } = service([fakeUser()], box.mailer);
    await reset.request('admin@example.invalid', NOW);
    await reset.request('admin@example.invalid', new Date(NOW.getTime() + 60_000));
    expect(box.letters).toHaveLength(1);

    await reset.request('admin@example.invalid', new Date(NOW.getTime() + 6 * 60_000));
    expect(box.letters).toHaveLength(2);
  });

  it('без настроенной отправки — понятная ошибка, а не тишина', async () => {
    const { reset } = service([fakeUser()], null);
    await expect(reset.request('admin@example.invalid', NOW)).rejects.toThrow(/не настроена/);
  });
});

describe('PasswordResetService.confirm', () => {
  async function withLink(users = [fakeUser()]) {
    const box = sent();
    const world = service(users, box.mailer);
    await world.reset.request(users[0]!.email, NOW);
    const link = box.letters[0]!.text.match(/https:\/\/\S+/)?.[0] ?? '';
    return { ...world, box, token: new URL(link).searchParams.get('token') ?? '' };
  }

  it('ставит новый пароль, включает учётную запись и гасит прежние сессии', async () => {
    const world = await withLink([fakeUser({ passwordHash: '' })]);
    await world.reset.confirm({ token: world.token, password: 'zhanga-parol-2026' }, NOW);

    expect(world.users[0]!.status).toBe('ACTIVE');
    expect(verifyPassword('zhanga-parol-2026', world.users[0]!.passwordHash)).toBe(true);
    expect(world.resets[0]!.usedAt).toEqual(NOW);

    // и по ней уже можно войти
    await expect(
      world.auth.login({ email: 'admin@example.invalid', password: 'zhanga-parol-2026' }, NOW),
    ).resolves.toMatchObject({ user: { email: 'admin@example.invalid' } });
  });

  it('вторая попытка по той же ссылке не проходит', async () => {
    const world = await withLink();
    await world.reset.confirm({ token: world.token, password: 'zhanga-parol-2026' }, NOW);
    await expect(
      world.reset.confirm({ token: world.token, password: 'basqa-parol-2026' }, NOW),
    ).rejects.toThrow(/уже использована|не годится/i);
  });

  it('просроченная ссылка не проходит', async () => {
    const world = await withLink();
    const later = new Date(NOW.getTime() + 25 * 3_600_000);
    await expect(
      world.reset.confirm({ token: world.token, password: 'zhanga-parol-2026' }, later),
    ).rejects.toThrow(/истёк|не годится/i);
  });

  it('чужой токен не проходит', async () => {
    const world = await withLink();
    await expect(
      world.reset.confirm({ token: 'выдуманный-токен', password: 'zhanga-parol-2026' }, NOW),
    ).rejects.toThrow();
  });

  it('слабый пароль отклоняется, ссылка остаётся годной', async () => {
    const world = await withLink();
    await expect(
      world.reset.confirm({ token: world.token, password: '123456' }, NOW),
    ).rejects.toThrow(/короче/);
    expect(world.resets[0]!.usedAt).toBeNull();
  });

  it('смена пароля по ссылке отзывает открытые сессии сотрудника', async () => {
    const world = await withLink();
    const session = await world.auth.login(
      { email: 'admin@example.invalid', password: 'luxx-stoika-2026' },
      NOW,
    );
    await world.reset.confirm({ token: world.token, password: 'zhanga-parol-2026' }, NOW);
    await expect(world.auth.whoami(session.token, NOW)).resolves.toBeNull();
  });

  it('пароль не попадает в журнал', async () => {
    const world = await withLink();
    await world.reset.confirm({ token: world.token, password: 'zhanga-parol-2026' }, NOW);
    expect(JSON.stringify(world.audit)).not.toContain('zhanga-parol-2026');
    expect(world.audit.map((a) => a.action)).toContain('user.password.changed');
  });
});

/**
 * Отказ почтовой службы (сверка 20.09.2026). До правки письмо слалось без `try/catch`: Resend
 * отвечает ошибкой — ссылка уже выдана и погасила прежнюю, человек остаётся без обеих, а повтор
 * упирается в «не чаще одного письма в пять минут».
 */
describe('почтовая служба отказала', () => {
  const broken = {
    async send() {
      throw new Error('Resend: 503');
    },
  };

  it('сброс пароля: живой ссылки не остаётся, и следующая попытка не упирается в ожидание', async () => {
    const { reset, resets } = service([fakeUser()], broken);
    await reset.request('admin@example.invalid', NOW);
    expect(resets.every((r) => r.usedAt !== null), 'выданная ссылка погашена').toBe(true);

    // повтор сразу же, без пятиминутного ожидания: первой отправки ведь не было
    const box = sent();
    const second = service([fakeUser()], box.mailer);
    await second.reset.request('admin@example.invalid', NOW);
    expect(box.letters).toHaveLength(1);
  });
});
