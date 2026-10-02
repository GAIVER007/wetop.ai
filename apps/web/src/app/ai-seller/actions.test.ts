import { afterEach, expect, it, vi } from 'vitest';
import { sellerApi } from '../../lib/api';
import { llmKeySaveAction } from './actions';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
it('empty replacement cannot remove an existing model key', async () => {
  const save = vi.spyOn(sellerApi, 'saveLlmKey').mockResolvedValue({ set: false, last4: null });
  const result = await llmKeySaveAction(null, new FormData());
  expect(result.error).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
});
it('explicit removal remains available', async () => {
  const save = vi.spyOn(sellerApi, 'saveLlmKey').mockResolvedValue({ set: false, last4: null });
  const form = new FormData();
  form.set('clear', '1');
  expect((await llmKeySaveAction(null, form)).error).toBeNull();
  expect(save).toHaveBeenCalledWith('');
});
