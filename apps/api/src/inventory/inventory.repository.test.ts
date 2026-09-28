import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { PrismaInventoryRepository } from './inventory.repository';

/**
 * Скорость (волна 4, plans/wetop-domain-2026-09-14.md §7.4). Дерево фонда — здание → этаж → комната → единица —
 * читалось заново на каждый запрос: 5+ обращений к базе в Сингапуре (~0,35 с каждое) на «Номера», «Фонд» и карточку
 * брони. Фонд меняет только импорт — дерево держится в памяти, а действующие блокировки считаются на каждый запрос.
 */
function fakePrisma() {
  const calls = { tree: 0, blocks: 0 };
  let blocks = 0;
  const unit = (code: string) => ({
    code,
    kind: 'BED',
    accommodationTypeId: 't1',
  });
  const db = {
    property: {
      async findFirst(args: { include?: unknown }) {
        if (args.include) calls.tree += 1;
        return {
          id: 'p1',
          name: 'Luxx Aparts',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          accommodationTypes: [
            {
              id: 't1',
              code: 'DORM',
              name: 'Общий',
              kind: 'BED',
              capacityAdults: 1,
              capacityChildren: 0,
            },
          ],
          buildings: [
            {
              name: 'Корпус',
              floors: [
                {
                  name: '1',
                  physicalRooms: [
                    { roomNumber: '1', capacity: 6, isDorm: true, units: [unit('5'), unit('6')] },
                  ],
                },
              ],
            },
          ],
        };
      },
    },
    inventoryBlock: {
      async count() {
        calls.blocks += 1;
        return blocks;
      },
    },
  };
  return {
    repo: new PrismaInventoryRepository({ db } as unknown as PrismaService),
    calls,
    setBlocks: (n: number) => {
      blocks = n;
    },
  };
}

describe('PrismaInventoryRepository', () => {
  it('дерево фонда читается один раз, а блокировки — на каждый запрос', async () => {
    const { repo, calls, setBlocks } = fakePrisma();
    const first = await repo.read();
    setBlocks(3);
    const second = await repo.read();
    expect(calls.tree).toBe(1);
    expect(calls.blocks).toBe(2);
    expect(first?.plan.units.map((u) => u.code)).toEqual(['5', '6']);
    expect(second?.blocks).toBe(3);
  });
});
