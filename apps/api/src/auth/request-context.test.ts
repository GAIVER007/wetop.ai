import { describe, expect, it } from 'vitest';
import {
  actorIsOwner,
  actorIsPlatformAdmin,
  attachAuthor,
  currentRole,
  currentUserId,
  databaseTenant,
  withOrganizationScope,
  withServiceDatabase,
  withSignedInUser,
} from './request-context';

describe('withSignedInUser и currentUserId', () => {
  it('внутри запроса виден вошедший, снаружи — никто', async () => {
    expect(currentUserId()).toBeNull();
    await withSignedInUser('u-1', async () => {
      expect(currentUserId()).toBe('u-1');
      await withSignedInUser('u-2', async () => expect(currentUserId()).toBe('u-2'));
      expect(currentUserId()).toBe('u-1');
    });
    expect(currentUserId()).toBeNull();
  });

  it('служебный ходок (сторож, скрипты) автора не подставляет', async () => {
    await withSignedInUser(null, async () => expect(currentUserId()).toBeNull());
  });

  it('параллельные запросы не путают авторов', async () => {
    const seen: string[] = [];
    await Promise.all([
      withSignedInUser('u-1', async () => {
        await new Promise((r) => setTimeout(r, 5));
        seen.push(currentUserId() ?? 'никто');
      }),
      withSignedInUser('u-2', async () => {
        seen.push(currentUserId() ?? 'никто');
      }),
    ]);
    expect(seen.sort()).toEqual(['u-1', 'u-2']);
  });
});

describe('attachAuthor — подстановка автора в запись журнала', () => {
  it('ставит вошедшего, если автор не указан', () => {
    expect(attachAuthor({ data: { action: 'reservation.checkIn' } }, 'u-1')).toEqual({
      data: { action: 'reservation.checkIn', userId: 'u-1' },
    });
  });

  it('не перебивает автора, указанного явно', () => {
    expect(attachAuthor({ data: { action: 'user.login', userId: 'u-9' } }, 'u-1')).toEqual({
      data: { action: 'user.login', userId: 'u-9' },
    });
  });

  it('без вошедшего оставляет запись как была: это действие сторожа или импорта', () => {
    expect(attachAuthor({ data: { action: 'exely.sync' } }, null)).toEqual({
      data: { action: 'exely.sync' },
    });
  });

  it('пачку записей подписывает целиком', () => {
    expect(
      attachAuthor({ data: [{ action: 'a' }, { action: 'b', userId: 'u-9' }] }, 'u-1'),
    ).toEqual({ data: [{ action: 'a', userId: 'u-1' }, { action: 'b', userId: 'u-9' }] });
  });

  it('чужую форму аргументов не ломает', () => {
    expect(attachAuthor({ where: { id: 'x' } } as never, 'u-1')).toEqual({ where: { id: 'x' } });
  });
});

describe('роль и главный администратор в запросе (DATA_MODEL §16, ADR-083)', () => {
  it('владелец и сотрудник организации различаются; служебный ходок считается владельцем — он и есть владелец', async () => {
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-1', role: 'OWNER' }, async () => {
      expect(currentRole()).toBe('OWNER');
      expect(actorIsOwner()).toBe(true);
    });
    await withSignedInUser({ userId: 'u-2', organizationId: 'org-1', role: 'STAFF' }, async () => {
      expect(currentRole()).toBe('STAFF');
      expect(actorIsOwner()).toBe(false);
    });
    await withSignedInUser(null, async () => {
      expect(currentRole()).toBeNull();
      expect(actorIsOwner()).toBe(true);
    });
  });

  it('вошедший без известной роли — не владелец: права не выдаются по умолчанию', async () => {
    await withSignedInUser({ userId: 'u-3', organizationId: 'org-1' }, async () => {
      expect(actorIsOwner()).toBe(false);
    });
  });

  it('главный администратор — только вошедший с отметкой; служебный ходок им не считается', async () => {
    await withSignedInUser(
      { userId: 'u-1', organizationId: 'org-1', role: 'OWNER', platformAdmin: true },
      async () => expect(actorIsPlatformAdmin()).toBe(true),
    );
    await withSignedInUser({ userId: 'u-2', organizationId: 'org-1', role: 'OWNER' }, async () =>
      expect(actorIsPlatformAdmin()).toBe(false),
    );
    await withSignedInUser(null, async () => expect(actorIsPlatformAdmin()).toBe(false));
  });
});

/**
 * Запрос Prisma ленивый: уходит в базу на `then`. Помощник контекста обязан дождаться его ВНУТРИ — иначе запрос
 * выполнится снаружи, другой ролью базы и другой организацией (RLS, DATA_MODEL §17, ADR-103). Найдено 27.09.2026:
 * `withServiceDatabase(() => db.property.findFirst(...))` уходил в базу ролью организации вошедшего.
 */
describe('помощники контекста дожидаются ленивого запроса внутри', () => {
  /** Как PrismaPromise: работа начинается только на then и читает контекст в этот момент */
  const lazy = () => ({
    then<R>(resolve: (v: { tenant: string | null; service: boolean }) => R) {
      return Promise.resolve({ tenant: databaseTenant(), service: databaseTenant() === null }).then(resolve);
    },
  }) as unknown as Promise<{ tenant: string | null; service: boolean }>;
  const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';

  it('withSignedInUser — организация вошедшего', async () => {
    const seen = await withSignedInUser({ userId: 'u', organizationId: ORG }, lazy);
    expect(seen.tenant).toBe(ORG);
  });

  it('withServiceDatabase внутри запроса человека — служебная роль', async () => {
    const seen = await withSignedInUser({ userId: 'u', organizationId: ORG }, () => withServiceDatabase(lazy));
    expect(seen.service).toBe(true);
  });

  it('withOrganizationScope — организация сайта', async () => {
    const seen = await withOrganizationScope(ORG, lazy);
    expect(seen.tenant).toBe(ORG);
  });
});
