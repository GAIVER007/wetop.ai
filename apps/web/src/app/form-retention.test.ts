import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, analyticsApi, guestsApi, unitsApi } from '../lib/api';
import { addDocumentAction, updateGuestAction } from './guests/[id]/actions';
import { blockUnitAction } from './units/[code]/actions';
import { createSiteAction } from './analytics/actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

it.each(['profile', 'document', 'block', 'site'] as const)(
  'сохраняет разрешённые поля формы %s после отказа API',
  async (kind) => {
    const values = {
      profile: { firstName: 'Synthetic', lastName: 'Guest', notes: 'Черновик' },
      document: { type: 'OTHER', number: 'TEST-ONLY', issueCountry: 'KAZ' },
      block: { dateFrom: '2026-09-15', dateTo: '2026-09-18', reason: 'Ремонт' },
      site: { name: 'Тестовый сайт', hosts: 'example.invalid, test.invalid' },
    }[kind];
    const fd = new FormData();
    for (const [key, value] of Object.entries(values)) fd.set(key, value);
    fd.set('unexpected', 'Не возвращать');
    const failure = new ApiError(503, 'Временный отказ');
    vi.spyOn(guestsApi, 'update').mockRejectedValue(failure);
    vi.spyOn(guestsApi, 'addDocument').mockRejectedValue(failure);
    vi.spyOn(unitsApi, 'block').mockRejectedValue(failure);
    vi.spyOn(analyticsApi, 'create').mockRejectedValue(failure);
    const previous = { error: null, message: null };
    const result = await (kind === 'profile'
      ? updateGuestAction('guest', previous, fd)
      : kind === 'document'
        ? addDocumentAction('guest', previous, fd)
        : kind === 'block'
          ? blockUnitAction('R01', previous, fd)
          : createSiteAction(previous, fd));
    expect(result).toMatchObject({ error: 'Временный отказ', attempt: 1, values });
    expect(result).not.toHaveProperty('values.unexpected');
  },
);
