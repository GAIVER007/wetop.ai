import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CashShiftsService } from './cash-shifts.service';
import type { PrismaService } from '../database/prisma.provider';

describe('cash command boundary', () => {
  it.each([null, 123, {}, [randomUUID()]])(
    'rejects a non-string command key before entering a money transaction: %j',
    async (key) => {
      const transaction = vi.fn().mockRejectedValue(new Error('Money transaction must not start'));
      const service = new CashShiftsService({
        db: { $transaction: transaction },
      } as unknown as PrismaService);
      await expect(
        service.command({ key: key as string, action: 'open', counted: '0' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});

// владелец 30.10.2026: «комментарий к расходу обязательно», без него расход не сохраняется (макет «Расход»)
describe('расход без комментария', () => {
  it.each(['', '   ', undefined])('отклоняется до денежной транзакции: %j', async (note) => {
    const transaction = vi.fn().mockRejectedValue(new Error('Money transaction must not start'));
    const service = new CashShiftsService({ db: { $transaction: transaction } } as unknown as PrismaService);
    await expect(
      service.command({ key: randomUUID(), action: 'expense', amount: '60', method: 'CASH', category: 'Такси', ...(note === undefined ? {} : { note }) } as never),
    ).rejects.toThrow('Напишите комментарий к расходу');
    expect(transaction).not.toHaveBeenCalled();
  });
});

