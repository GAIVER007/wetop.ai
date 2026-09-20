import { describe, expect, it } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { auditUserId, currentActor, runAsActor } from './actor';

const ACTOR = { userId: 'u-1', organizationId: 'org-1' };

describe('actor', () => {
  it('вне запроса автора нет', () => {
    expect(currentActor()).toBeNull();
    expect(auditUserId()).toBeNull();
  });

  it('внутри runAsActor автор виден, в том числе после await', async () => {
    await runAsActor(ACTOR, async () => {
      expect(currentActor()).toEqual(ACTOR);
      await new Promise((r) => setTimeout(r, 1));
      expect(auditUserId()).toBe('u-1');
    });
    expect(currentActor()).toBeNull();
  });

  it('два запроса не видят друг друга', async () => {
    const seen: Array<string | null> = [];
    await Promise.all([
      runAsActor({ userId: 'a', organizationId: 'o' }, async () => {
        await new Promise((r) => setTimeout(r, 2));
        seen.push(auditUserId());
      }),
      runAsActor({ userId: 'b', organizationId: 'o' }, async () => {
        seen.push(auditUserId());
      }),
    ]);
    expect(seen.sort()).toEqual(['a', 'b']);
  });

  // Q-146: вошедший по паролю приходит не через middleware, а через замок SessionGuard — автор тот же
  it('вошедший по паролю (контекст запроса замка) — тоже автор строки журнала', async () => {
    await withSignedInUser('u-9', async () => {
      expect(currentActor()).toBeNull();
      expect(auditUserId()).toBe('u-9');
    });
    expect(auditUserId()).toBeNull();
  });

  it('если известны оба, побеждает автор из middleware — он и есть сессия запроса', async () => {
    await withSignedInUser('u-9', async () => {
      await runAsActor(ACTOR, async () => {
        expect(auditUserId()).toBe('u-1');
      });
    });
  });
});
