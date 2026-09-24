import { describe, expect, it } from 'vitest';
import { createPrismaClient } from './index';

/**
 * SECURITY.md §7: текст ошибки базы уходит в `last_error`, в неисправности и в журнал API. По умолчанию Prisma печатает
 * в нём аргументы вызова — заметку брони, имя, телефон. `minimal` оставляет код и суть ошибки без аргументов.
 * Подключения здесь нет: клиент соединяется с базой при первом запросе.
 */
describe('createPrismaClient', () => {
  it('ошибки без аргументов вызова: errorFormat minimal', async () => {
    const db = createPrismaClient('postgresql://nobody@127.0.0.1:1/none', undefined);
    try {
      expect((db as unknown as { _errorFormat?: string })._errorFormat).toBe('minimal');
    } finally {
      await db.$disconnect();
    }
  });
});
