import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard, tokenFromHeaders } from './auth.guard';
import { PUBLIC_ROUTE } from './public.decorator';

const user = {
  id: 'u-1',
  email: 'admin@example.invalid',
  fullName: 'Айгуль Тестова',
  role: 'DESK' as const,
};

function context(headers: Record<string, string> = {}, method = 'GET', url = '/desk/today') {
  const request: Record<string, unknown> & { headers: Record<string, string> } = {
    headers,
    method,
    url,
  };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as never,
  };
}

const reflector = (isPublic: boolean) =>
  ({ getAllAndOverride: () => (isPublic ? true : undefined) }) as never;
const auth = (ok: boolean) =>
  ({
    whoami: vi.fn(async () => (ok ? { user, expiresAt: '2026-09-16T00:00:00.000Z' } : null)),
  }) as never;

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
    delete process.env.GUARD_READ_KEY;
    delete process.env.ASSISTANT_READ_KEY;
  });

  it('пока вход не включён, пускает всех и никого не спрашивает', async () => {
    const { ctx, request } = context();
    const service = auth(false);
    await expect(new SessionGuard(reflector(false), service).canActivate(ctx)).resolves.toBe(true);
    expect(
      (service as unknown as { whoami: { mock: { calls: unknown[] } } }).whoami.mock.calls,
    ).toHaveLength(0);
    expect(request.user).toBeUndefined();
  });

  /*
   * ТЗ аудита 25.09.2026, В-2: замок fail-closed. В production он включён всегда, любое значение,
   * кроме явного '0', означает «закрыто» — опечатка или пустая переменная не открывают API молча.
   */
  describe('в production (NODE_ENV=production)', () => {
    const nodeEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });
    afterEach(() => {
      process.env.NODE_ENV = nodeEnv;
    });

    it('переменная не задана — замок закрыт', async () => {
      const { ctx } = context();
      await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('опечатка вроде AUTH_REQUIRED=true — замок закрыт, а не молча открыт', async () => {
      process.env.AUTH_REQUIRED = 'true';
      const { ctx } = context();
      await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('выключается только явным нулём', async () => {
      process.env.AUTH_REQUIRED = '0';
      const { ctx, request } = context();
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).resolves.toBe(
        true,
      );
      expect(request.user).toBeUndefined();
    });
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
      await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).resolves.toBe(
        true,
      );
      expect(request.user).toEqual(user);
    });

    it('с негодным токеном не пускает', async () => {
      const { ctx } = context({ authorization: 'Bearer stale' });
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow(/Войдите/);
    });

    it('публичный маршрут пускает без токена: счётчик сайта, виджет и webhook работают снаружи', async () => {
      const { ctx, request } = context();
      await expect(new SessionGuard(reflector(true), auth(false)).canActivate(ctx)).resolves.toBe(
        true,
      );
      expect(request.user).toBeUndefined();
    });

    it('служебный ключ пускает сторожа и скрипты сверки', async () => {
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx, request } = context({ 'x-wetop-service-key': 'ключ-сторожа' });
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).resolves.toBe(
        true,
      );
      expect(request.service).toBe(true);
    });

    it('неверный служебный ключ не пускает', async () => {
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx } = context({ 'x-wetop-service-key': 'не-тот' });
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow();
    });

    it('ключ той же длины, но другой, не пускает — сравнение идёт до конца, а не до первого знака', async () => {
      // Сверка 20.09.2026: обычное `===` выходит на первом несовпавшем знаке, и по времени ответа
      // ключ подбирается знак за знаком. Здесь проверяем поведение, время меряет не тест.
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx } = context({ 'x-wetop-service-key': 'ключ-сторожб' });
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow();
    });

    it('ключ другой длины не пускает и не роняет замок', async () => {
      process.env.SERVICE_API_KEY = 'ключ-сторожа';
      const { ctx } = context({ 'x-wetop-service-key': 'ключ' });
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow(/Служебный ключ не подходит/);
    });

    it('когда служебный ключ в окружении не задан, служебный заголовок ничего не даёт', async () => {
      const { ctx } = context({ 'x-wetop-service-key': '' });
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow();
    });
  });

  it('пока вход не включён, но токен пришёл — узнаёт автора, чтобы журнал знал, кто действовал', async () => {
    const { ctx, request } = context({ authorization: 'Bearer good' });
    await expect(new SessionGuard(reflector(false), auth(true)).canActivate(ctx)).resolves.toBe(
      true,
    );
    expect(request.user).toEqual(user);
  });

  it('пока вход не включён, негодный токен не мешает работать', async () => {
    const { ctx, request } = context({ authorization: 'Bearer stale' });
    await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).resolves.toBe(
      true,
    );
    expect(request.user).toBeUndefined();
  });

  it('метка публичного маршрута читается тем же ключом, которым её ставит декоратор', () => {
    expect(PUBLIC_ROUTE).toBe('wetop:public-route');
  });

  describe('ключ дежурного агента (GUARD_READ_KEY)', () => {
    beforeEach(() => {
      process.env.AUTH_REQUIRED = '1';
      process.env.SERVICE_API_KEY = 'служебный-ключ-длинный';
      process.env.GUARD_READ_KEY = 'ключ-агента-только-чтение';
    });

    it('пускает читать неисправности сторожа', async () => {
      for (const url of ['/guard/incidents', '/guard/incidents?status=all', '/guard/status']) {
        const { ctx, request } = context(
          { 'x-wetop-service-key': 'ключ-агента-только-чтение' },
          'GET',
          url,
        );
        await expect(
          new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
        ).resolves.toBe(true);
        expect(request.service).toBe(true);
      }
    });

    it('не пускает закрывать неисправность, дёргать сторожа и слать пробную тревогу', async () => {
      for (const [method, url] of [
        ['POST', '/guard/incidents/11111111-1111-1111-1111-111111111111/resolve'],
        ['POST', '/guard/incidents/11111111-1111-1111-1111-111111111111/acknowledge'],
        ['POST', '/guard/tick'],
        ['POST', '/guard/alert/test'],
      ] as const) {
        const { ctx } = context(
          { 'x-wetop-service-key': 'ключ-агента-только-чтение' },
          method,
          url,
        );
        await expect(
          new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
        ).rejects.toThrow(/читает только неисправности/);
      }
    });

    it('не открывает остальной API: ни броней, ни денег, ни учёток', async () => {
      for (const url of ['/desk/today', '/reservations', '/finance/payments', '/auth/me']) {
        const { ctx } = context({ 'x-wetop-service-key': 'ключ-агента-только-чтение' }, 'GET', url);
        await expect(
          new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
        ).rejects.toThrow(/читает только неисправности/);
      }
    });

    it('служебный ключ по-прежнему открывает всё, а чужой ключ не пускает никуда', async () => {
      const { ctx, request } = context(
        { 'x-wetop-service-key': 'служебный-ключ-длинный' },
        'POST',
        '/reservations',
      );
      await expect(new SessionGuard(reflector(false), auth(false)).canActivate(ctx)).resolves.toBe(
        true,
      );
      expect(request.service).toBe(true);

      const чужой = context(
        { 'x-wetop-service-key': 'ключ-агента-только-чтениЯ' },
        'GET',
        '/guard/status',
      );
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(чужой.ctx),
      ).rejects.toThrow(/не подходит/);
    });
  });

  /**
   * Узкий ключ ИИ-помощника (ТЗ ред. 1 П4, ADR-079) — по образцу ключа дежурного агента (ADR-067): помощник видит
   * ошибки человека и состояние системы и больше ничего. Всё остальное, включая запись, — 403.
   */
  describe('ключ ИИ-помощника (ASSISTANT_READ_KEY)', () => {
    beforeEach(() => {
      process.env.AUTH_REQUIRED = '1';
      process.env.SERVICE_API_KEY = 'служебный-ключ-длинный';
      process.env.GUARD_READ_KEY = 'ключ-агента-только-чтение';
      process.env.ASSISTANT_READ_KEY = 'ключ-помощника-только-чтение';
    });

    it('пускает ровно на два адреса: ошибки человека и состояние системы', async () => {
      for (const url of [
        '/assistant/errors?userId=u&organizationId=o',
        '/assistant/errors',
        '/guard/status',
      ]) {
        const { ctx, request } = context(
          { 'x-wetop-service-key': 'ключ-помощника-только-чтение' },
          'GET',
          url,
        );
        await expect(
          new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
        ).resolves.toBe(true);
        expect(request.service).toBe(true);
      }
    });

    it('неисправности, запись и остальной API — 403', async () => {
      for (const [method, url] of [
        ['GET', '/guard/incidents'],
        ['POST', '/guard/tick'],
        ['POST', '/assistant/errors'],
        ['GET', '/assistant/identity'],
        ['GET', '/reservations'],
        ['GET', '/guests'],
        ['POST', '/finance/payments'],
        ['GET', '/auth/me'],
      ] as const) {
        const { ctx } = context(
          { 'x-wetop-service-key': 'ключ-помощника-только-чтение' },
          method,
          url,
        );
        await expect(
          new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
        ).rejects.toThrow(/Ключ помощника читает только/);
      }
    });

    it('ключ дежурного агента ошибок человека не читает', async () => {
      const { ctx } = context(
        { 'x-wetop-service-key': 'ключ-агента-только-чтение' },
        'GET',
        '/assistant/errors',
      );
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow(/читает только неисправности/);
    });

    it('похожий ключ не пускает: сравнение до конца', async () => {
      const { ctx } = context(
        { 'x-wetop-service-key': 'ключ-помощника-только-чтениЕ' },
        'GET',
        '/guard/status',
      );
      await expect(
        new SessionGuard(reflector(false), auth(false)).canActivate(ctx),
      ).rejects.toThrow(/не подходит/);
    });
  });
});
