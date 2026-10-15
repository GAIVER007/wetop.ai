import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { withIntegrationPropertyScope } from '../../apps/api/src/auth/request-context';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import { localPropertyForChannex } from '../../apps/api/src/channels/mapped-properties';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

const url = process.env.DATABASE_URL;
describe.skipIf(!url)('Channex branch isolation on a database', () => {
  it('resolves each provider ID and keeps concurrent reads on their own branch', async () => {
    const db = createPrismaClient(url!);
    const rollback = new Error('rollback synthetic fixture');
    let checked = false;
    try {
      await db.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: 'Synthetic Channex branches' } });
        const props = [];
        for (const label of ['A', 'B']) {
          props.push(
            await createPropertyInChain(tx, org.id, {
              name: `Synthetic branch ${label}`,
              timezone: 'Asia/Almaty',
              currency: 'KZT',
              checkInTime: '14:00',
              checkOutTime: '12:00',
            }),
          );
        }
        for (let i = 0; i < props.length; i++) {
          await tx.channelMapping.create({
            data: {
              propertyId: props[i]!.id,
              provider: 'channex',
              providerPropertyId: `synthetic-${props[i]!.id}`,
            },
          });
        }
        const repo = new PrismaChannelsRepository({ db: tx } as unknown as PrismaService);
        const results = await Promise.all(
          props.map((property) =>
            withIntegrationPropertyScope(property.id, async () => ({
              selected: await repo.currentPropertyId(),
              mappings: await repo.mappings('channex'),
            })),
          ),
        );
        for (let i = 0; i < props.length; i++) {
          expect(results[i]!.selected).toBe(props[i]!.id);
          expect(results[i]!.mappings.map((row) => row.providerPropertyId)).toEqual([
            `synthetic-${props[i]!.id}`,
          ]);
          expect(await localPropertyForChannex(tx as never, `synthetic-${props[i]!.id}`)).toBe(
            props[i]!.id,
          );
        }
        checked = true;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$disconnect();
    }
    expect(checked).toBe(true);
  });
});
