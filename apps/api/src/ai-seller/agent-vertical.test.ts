import type { PrismaService } from '../database/prisma.provider';
import { expect, it, vi } from 'vitest';
import { PrismaBusinessAgentsRepository } from './business-agents.repository';
it('agent view preserves server-resolved business vertical', async () => {
  const row = { id: 'agent', name: 'Агент', lifecycle: 'draft', createdAt: new Date(), updatedAt: new Date(),
    location: { id: 'loc', name: 'Филиал', business: { id: 'biz', name: 'Салон', vertical: 'BEAUTY' } } };
  const db = { sellerAgent: { findFirst: vi.fn(async () => row) } };
  const repo = new PrismaBusinessAgentsRepository({ db } as unknown as PrismaService);
  const result = await repo.get('org', 'agent');
  expect(result?.business).toEqual({ id: 'biz', name: 'Салон', vertical: 'BEAUTY' });
});
