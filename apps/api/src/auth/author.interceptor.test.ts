import 'reflect-metadata';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthorInterceptor } from './author.interceptor';
import { actorIsPlatformAdmin, currentOrganizationId, currentRole, currentUserId } from './request-context';

const context = (user?: {
  id: string;
  organizationId?: string;
  role?: 'OWNER' | 'STAFF';
  platformAdmin?: boolean;
}) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;

describe('AuthorInterceptor — автор виден всему, что делает обработчик', () => {
  it('внутри обработчика виден вошедший', async () => {
    let seen: string | null = 'не спрашивали';
    const next = {
      handle: () => {
        seen = currentUserId();
        return of('ответ');
      },
    };
    const result = await new AuthorInterceptor().intercept(context({ id: 'u-1' }), next as never);
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
    await new AuthorInterceptor().intercept(context(), next as never);
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
    await new AuthorInterceptor().intercept(
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
    await new AuthorInterceptor().intercept(context(), next as never);
    expect(seen).toBeNull();
  });

  it('пустой ответ обработчика не роняет запрос', async () => {
    const next = { handle: () => of(undefined) };
    await expect(
      new AuthorInterceptor().intercept(context({ id: 'u-1' }), next as never),
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
    await new AuthorInterceptor().intercept(
      context({ id: 'u-1', organizationId: 'org-luxx', role: 'STAFF', platformAdmin: true }),
      next as never,
    );
    expect(seen).toEqual({ role: 'STAFF', admin: true });
  });
});
