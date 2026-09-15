import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { hashSessionToken, verifyPassword } from '@pms/domain';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
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
    auth: new AuthService(world.prisma),
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
    const world = await withLink([fakeUser({ status: 'INVITED', passwordHash: '' })]);
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

describe('PasswordResetService.invite', () => {
  it('заводит сотрудника, шлёт приглашение и возвращает ссылку', async () => {
    const box = sent();
    const { reset, users, resets } = service([fakeUser()], box.mailer);

    const result = await reset.invite(
      { email: 'Nova@Example.Invalid', fullName: 'Нова Тестова', role: 'DESK' },
      NOW,
    );

    expect(result.sent).toBe(true);
    expect(result.link).toContain('/login/set-password?token=');
    expect(users.map((u) => u.email)).toContain('nova@example.invalid');
    expect(users.find((u) => u.email === 'nova@example.invalid')!.status).toBe('INVITED');
    expect(resets).toHaveLength(1);
    expect(box.letters[0]!.subject).toBe('WETOP: задайте пароль для входа');
    expect(box.letters[0]!.text).toContain('Нова Тестова');
  });

  it('без настроенной отправки заводит сотрудника и отдаёт ссылку владельцу', async () => {
    const { reset, users } = service([fakeUser()], null);
    const result = await reset.invite(
      { email: 'nova2@example.invalid', fullName: 'Нова Вторая', role: 'DESK' },
      NOW,
    );
    expect(result.sent).toBe(false);
    expect(result.link).toContain('/login/set-password?token=');
    expect(users).toHaveLength(2);
  });

  it('повторное приглашение на занятую почту не создаёт второго сотрудника', async () => {
    const { reset } = service();
    await expect(
      reset.invite({ email: 'admin@example.invalid', fullName: 'Дубль', role: 'DESK' }, NOW),
    ).rejects.toThrow(/уже есть|занята/i);
  });

  it('мусор вместо почты не принимается', async () => {
    const { reset } = service();
    await expect(
      reset.invite({ email: 'не-почта', fullName: 'Имя', role: 'DESK' }, NOW),
    ).rejects.toThrow();
  });
});
