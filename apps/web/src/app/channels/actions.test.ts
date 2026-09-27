import { afterEach, expect, it, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { channelsApi } from '../../lib/api';
import { channelAction, retryEventAction } from './actions';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const affected = [
  '/today',
  '/management/statistics',
  '/rooms/availability',
  '/finance',
  '/guests',
  '/connections',
];
it('после импорта обновляет связанные отчёты и рабочие списки', async () => {
  vi.spyOn(channelsApi, 'pull').mockResolvedValue({ received: 0, acknowledged: 0, outcomes: [] });
  expect((await channelAction('pull')).error).toBeNull();
  for (const path of affected) expect(revalidatePath).toHaveBeenCalledWith(path);
  // модуль «Каналы продаж» со вкладками обновляется целиком (ADR-107)
  expect(revalidatePath).toHaveBeenCalledWith('/channels', 'layout');
});
it('повтор обработки обновляет те же данные без второго импорта', async () => {
  const retry = vi
    .spyOn(channelsApi, 'retryEvent')
    .mockResolvedValue({ result: 'created', confirmationNumber: null });
  await retryEventAction('revision');
  expect(retry).toHaveBeenCalledTimes(1);
  for (const path of affected) expect(revalidatePath).toHaveBeenCalledWith(path);
  expect(revalidatePath).toHaveBeenCalledWith('/channels', 'layout');
});
