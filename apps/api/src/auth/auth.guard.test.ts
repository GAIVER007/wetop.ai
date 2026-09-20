import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard, tokenFromHeaders } from './auth.guard';
import { PUBLIC_ROUTE } from './public.decorator';

const user = { id: 'u-1', email: 'admin@example.invalid', fullName: 'Айгуль Тестова', role: 'DESK' as const };

function context(headers: Record<string, string> = {}) {
  const request: Record<string, unknown> & { headers: Record<string, string> } = { headers };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as never,
  };
}

const reflector = (isPublic: boolean) => ({ getAllAndOverride: () => (isPublic ? true : undefined) }) as never;
const auth = (ok: boolean) =>
  ({ whoami: vi.fn(async () => (ok ? { user, expiresAt: '2026-09-16T00:00:00.000Z' } : null)) }) as never;

describe('tokenFromHeaders', () => {
  it('берёт токен из Authorization: Bearer и из x-wetop-session', () => {
    expect(tokenFromHeaders({ authorization: 'Bearer abc123' })).toBe('abc123');
    expect(tokenFromHeaders({ 'x-wetop-session': 'abc123' })).toBe('abc123');
    expect(tokenFromHeaders({ authorization: 'Basic abc123' })).toBeNull();
    expect(tokenFromHeaders({})).toBeNull();
  });
});

describe('SessionGuard', () => {
  beforeEach(() => {
    delete process.env.AUTH_REQUIRED;
    delete process.env.SERVICE_API_KEY;
  });

  it('пока вход не включён, пускает всех и никого не спрашивает', async () => {
    const { ctx, request } = context();
    const service = auth(false);
    await expect(new SessionGuard(reflector(false), service).canActivate(ctx)).resolves.toBe(true);
    expect((service as unknown as { whoami: { mock: { calls: unknown[] } } }).whoami.mock.calls).toHaveLength(0);
    expect(request.user).toBeUndefined();
  });

  describe('когда AUTH_REQUIRED=1', () => {
    beforeEach(() => {
      process.env.AUTH_REQUIRED = '1';
    });

    it('без токена не пускает', async () => {
      const { ctx } = context();
      await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).rejects.toThrow(
        /Войдите/,
      );
    });

    it('с годным токеном пускает и кладёт вошедшего в запрос', async () => {
      const { ctx, request } = context({ authorization: 'Bearer good' });
      await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).resolves.toBe(true);
      expect(request.user).toEqual(user);
    });

    it('с негодным токеном не пускает', async () => {
      const { ctx } = context({ authorization: 'Bearer stale' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).rejects.toThrow(
        /Войдите/,
      );
    });

    it('публичный маршрут пускает без токена: счётчик сайта, виджет и webhook работают снаружи', async () => {
      const { ctx, request } = context();
      await expect(new SessionGuard(reflector(true), auth(false)).canActivate(ctx)).resolves.toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('служебный ключ пускает сторожа и скрипты сверки', async () => {
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx, request } = context({ 'x-wetop-service-key': 'ключ-сторожа' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).resolves.toBe(true);
      expect(request.service).toBe(true);
    });

    it('неверный служебный ключ не пускает', async () => {
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx } = context({ 'x-wetop-service-key': 'не-тот' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).rejects.toThrow();
    });

    it('ключ той же длины, но другой, не пускает — сравнение идёт до конца, а не до первого знака', async () => {
      // Сверка 20.09.2026: обычное `===` выходит на первом несовпавшем знаке, и по времени ответа
      // ключ подбирается знак за знаком. Здесь проверяем поведение, время меряет не тест.
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx } = context({ 'x-wetop-service-key': 'ключ-сторожб' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).rejects.toThrow();
    });

    it('ключ другой длины не пускает и не роняет замок', async () => {
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx } = context({ 'x-wetop-service-key': 'ключ' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).rejects.toThrow(
        /Служебный ключ не подходит/,
      );
    });

    it('когда служебный ключ в окружении не задан, служебный заголовок ничего не даёт', async () => {
      const { ctx } = context({ 'x-wetop-service-key': '' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).rejects.toThrow();
    });
  });

  it('пока вход не включён, но токен пришёл — узнаёт автора, чтобы журнал знал, кто действовал', async () => {
    const { ctx, request } = context({ authorization: 'Bearer good' });
    await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });

  it('пока вход не включён, негодный токен не мешает работать', async () => {
    const { ctx, request } = context({ authorization: 'Bearer stale' });
    await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('метка публичного маршрута читается тем же ключом, которым её ставит декоратор', () => {
    expect(PUBLIC_ROUTE).toBe('wetop:public-route');
  });
});
