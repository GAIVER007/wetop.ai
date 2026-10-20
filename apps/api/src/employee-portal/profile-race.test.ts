import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { EmployeePortalService } from './employee-portal.service';
import { PrismaService } from '../database/prisma.provider';
import { withSignedInUser } from '../auth/request-context';

const organizationId = '00000000-0000-4000-8000-000000000001';
const businessId = '00000000-0000-4000-8000-000000000002';
const userId = '00000000-0000-4000-8000-000000000003';
const employeeId = '00000000-0000-4000-8000-000000000004';
const actor = { organizationId, businessId, userId, role: 'OWNER' as const, scope: 'BUSINESS' as const, vertical: 'BEAUTY' as const };

// beauty-ui run 39311929524: два параллельных показа кабинета одного мастера оба не нашли публичный профиль,
// второй INSERT упал на employee_public_profiles_pkey (P2002), и экран показал API_500.
// Строка, созданная соседним запросом, тот же результат: показ кабинета не должен падать.
describe('employee public profile lazy creation', () => {
  it('returns the row created by a concurrent request instead of failing on the unique key', async () => {
    const winner = { employeeId, slug: 'concurrent', revision: 1 };
    let stored: typeof winner | null = null;
    const db = {
      organization: { findUnique: vi.fn(async () => ({ status: 'ACTIVE', trialEndsAt: null })) },
      employeePublicProfile: {
        // наш первый взгляд: строки ещё нет; после этого её вставляет соседний запрос
        findUnique: vi.fn(async () => {
          const seen = stored;
          stored = winner;
          return seen;
        }),
        upsert: vi.fn(async () => {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }),
        createMany: vi.fn(async ({ skipDuplicates }: { skipDuplicates?: boolean }) => {
          if (!skipDuplicates) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          return { count: 0 };
        }),
        findUniqueOrThrow: vi.fn(async () => stored!),
      },
    };
    const service = new EmployeePortalService({ db } as unknown as PrismaService, null);
    const profile = (service as unknown as { profile(db: unknown, id: string): Promise<unknown> }).profile.bind(service);
    await expect(withSignedInUser(actor, () => profile(db, employeeId))).resolves.toEqual(winner);
  });
});
