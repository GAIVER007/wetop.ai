import 'reflect-metadata';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthorInterceptor } from './author.interceptor';
import {
  actorIsPlatformAdmin,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentRole,
  currentScope,
  currentUserId,
} from './request-context';

const context = (
  user?: {
    id: string;
    organizationId?: string;
    role?: 'OWNER' | 'STAFF';
    platformAdmin?: boolean;
  },
  headers: Record<string, string> = {},
) => ({ switchToHttp: () => ({ getRequest: () => ({ user, headers }) }) }) as never;

const B = '11111111-1111-4111-8111-111111111111';
const L = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** База для scope: считает обращения; свои Business и филиал — у org-luxx */
function scopeDb() {
  let calls = 0;
  const prisma = {
    db: {
      business: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) => {
          calls += 1;
          return where.id === B && where.organizationId === 'org-luxx'
            ? { id: B, vertical: 'HOSPITALITY' }
            : null;
        },
      },
      location: {
        findFirst: async ({ where }: { where: { id: string; businessId: string } }) => {
          calls += 1;
          return where.id === L && where.businessId === B ? { id: L } : null;
        },
      },
    },
  };
  return { prisma: prisma as never, calls: () => calls };
}
const interceptor = () => new AuthorInterceptor(scopeDb().prisma);

describe('AuthorInterceptor — автор виден всему, что делает обработчик', () => {
  it('внутри обработчика виден вошедший', async () => {
    let seen: string | null = 'не спрашивали';
    const next = {
      handle: () => {
        seen = currentUserId();
        return of('ответ');
      },
    };
    const result = await interceptor().intercept(context({ id: 'u-1' }), next as never);
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toBe('u-1');
    expect(result).toBeDefined();
  });

  it('без вошедшего автора нет: так ходят сторож, импорт и скрипты', async () => {
    let seen: string | null = 'не спрашивали';
    const next = {
      handle: () => {
        seen = currentUserId();
        return of('ответ');
      },
    };
    await interceptor().intercept(context(), next as never);
    expect(seen).toBeNull();
  });

  it('внутри обработчика видна организация вошедшего: по ней открывается его объект (ADR-061)', async () => {
    let seen: string | null = 'не спрашивали';
    const next = {
      handle: () => {
        seen = currentOrganizationId();
        return of('ответ');
      },
    };
    await interceptor().intercept(
      context({ id: 'u-1', organizationId: 'org-luxx' }),
      next as never,
    );
    expect(seen).toBe('org-luxx');
  });

  it('у служебного ходока организации нет — и объект ему не ограничивают', async () => {
    let seen: string | null = 'не спрашивали';
    const next = {
      handle: () => {
        seen = currentOrganizationId();
        return of('ответ');
      },
    };
    await interceptor().intercept(context(), next as never);
    expect(seen).toBeNull();
  });

  it('пустой ответ обработчика не роняет запрос', async () => {
    const next = { handle: () => of(undefined) };
    await expect(
      interceptor().intercept(context({ id: 'u-1' }), next as never),
    ).resolves.toBeDefined();
  });
});

describe('AuthorInterceptor — роль и отметка главного администратора (ADR-083)', () => {
  it('внутри обработчика видны роль вошедшего и его отметка', async () => {
    let seen: unknown = 'не спрашивали';
    const next = {
      handle: () => {
        seen = { role: currentRole(), admin: actorIsPlatformAdmin() };
        return of('ответ');
      },
    };
    await interceptor().intercept(
      context({ id: 'u-1', organizationId: 'org-luxx', role: 'STAFF', platformAdmin: true }),
      next as never,
    );
    expect(seen).toEqual({ role: 'STAFF', admin: true });
  });
});

/*
 * Platform P2, К1 (план P2 §4, ADR-120): scope вычисляет API из указателя X-Wetop-Scope — внутри контекста организации
 * вошедшего, до обработчика. Без указателя в базу не ходим; служебный ходок указатель не учитывает.
 */
describe('AuthorInterceptor — scope запроса (Platform P2, К1)', () => {
  const seenScope = () => {
    let seen: unknown = 'не спрашивали';
    const next = {
      handle: () => {
        seen = { scope: currentScope(), business: currentBusinessId(), location: currentLocationId() };
        return of('ответ');
      },
    };
    return { next: next as never, seen: () => seen };
  };

  it('вошедший без указателя — ORGANIZATION, в базу не ходим', async () => {
    const { prisma, calls } = scopeDb();
    const probe = seenScope();
    await new AuthorInterceptor(prisma).intercept(context({ id: 'u-1', organizationId: 'org-luxx' }), probe.next);
    expect(probe.seen()).toEqual({ scope: 'ORGANIZATION', business: null, location: null });
    expect(calls()).toBe(0);
  });

  it('вошедший со своим Business и филиалом — LOCATION виден обработчику', async () => {
    const { prisma } = scopeDb();
    const probe = seenScope();
    await new AuthorInterceptor(prisma).intercept(
      context({ id: 'u-1', organizationId: 'org-luxx' }, { 'x-wetop-scope': `business=${B};location=${L}` }),
      probe.next,
    );
    expect(probe.seen()).toEqual({ scope: 'LOCATION', business: B, location: L });
  });

  it('чужой указатель — тихо ORGANIZATION, обработчик выполняется', async () => {
    const { prisma } = scopeDb();
    const probe = seenScope();
    await new AuthorInterceptor(prisma).intercept(
      context({ id: 'u-1', organizationId: 'org-other' }, { 'x-wetop-scope': `business=${B};location=${L}` }),
      probe.next,
    );
    expect(probe.seen()).toEqual({ scope: 'ORGANIZATION', business: null, location: null });
  });

  it('модуль без базы указатель не проверит — scope организации, не выбранный', async () => {
    const probe = seenScope();
    await new AuthorInterceptor().intercept(
      context({ id: 'u-1', organizationId: 'org-luxx' }, { 'x-wetop-scope': `business=${B};location=${L}` }),
      probe.next,
    );
    expect(probe.seen()).toEqual({ scope: 'ORGANIZATION', business: null, location: null });
  });

  it('служебный ходок: указатель не учитывается и в базу не ходим', async () => {
    const { prisma, calls } = scopeDb();
    const probe = seenScope();
    await new AuthorInterceptor(prisma).intercept(
      context(undefined, { 'x-wetop-scope': `business=${B};location=${L}` }),
      probe.next,
    );
    expect(probe.seen()).toEqual({ scope: null, business: null, location: null });
    expect(calls()).toBe(0);
  });
});
