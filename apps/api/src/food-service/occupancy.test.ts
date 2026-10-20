import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DbTx } from '@pms/database';
import { occupancyCommand } from './occupancy';
import { FoodService } from './food.service';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
afterEach(() => vi.unstubAllEnvs());
describe('occupancy release safety', () => {
  it('reports unavailable when SQL returned no command result', async () => {
    vi.stubEnv('RESTAURANT_OCCUPANCY_CAPTURE', 'true');
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as DbTx;
    await expect(occupancyCommand(tx,'loc','key','SEAT','table',null,null,null,null)).rejects.toMatchObject({status:503});
  });
  it('rejects disabled direct commands before scope or database access', async () => {
    vi.stubEnv('RESTAURANT_OCCUPANCY_CAPTURE', 'false');
    const db = { $transaction: vi.fn() };
    const service = new FoodService({db} as unknown as PrismaService);
    await expect(withSignedInUser({userId:'user',organizationId:'org',role:'OWNER',scope:'LOCATION',businessId:'business',locationId:'loc',vertical:'FOOD_SERVICE'}, () => service.occupancy('key',{},'SEAT'))).rejects.toMatchObject({status:503});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
