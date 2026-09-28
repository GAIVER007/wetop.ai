import { describe, expect, it } from 'vitest';
import type { AriPublisher } from '../channels/ari-publisher';
import type { ReservationsRepository, UnitOfWork } from './reservations.repository';
import { ReservationsService } from './reservations.service';

/**
 * Справочник тарифов для формы брони и карточки (plans/wetop-domain-2026-09-14.md, Б9).
 * Под нагрузкой пула транзакция не открывается за maxWait 10 с → Prisma P2028 → 500, и карточка брони
 * целиком падает в экран ошибки. Чтение справочника транзакции не требует.
 */
describe('ReservationsService.ratePlans', () => {
  it('reads active rate plans without opening a transaction', async () => {
    const repo = {
      activeRatePlans: async () => [
        {
          id: 'plan-1',
          code: 'exely-10157482',
          name: 'Базовый тариф',
          currency: 'KZT',
          active: true,
          cancellationPenalty: 'NONE',
        },
      ],
    } as unknown as ReservationsRepository;
    const uow = {
      run: () =>
        Promise.reject(
          new Error('Transaction API error: Unable to start a transaction in the given time.'),
        ),
      read: <T>(fn: (r: ReservationsRepository) => Promise<T>) => fn(repo),
    } as unknown as UnitOfWork;
    const service = new ReservationsService(uow, {} as AriPublisher);

    await expect(service.ratePlans()).resolves.toEqual([
      {
        code: 'exely-10157482',
        name: 'Базовый тариф',
        currency: 'KZT',
        cancellationPenalty: 'NONE',
      },
    ]);
  });
});
