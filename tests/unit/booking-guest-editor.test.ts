import { expect, it, vi } from 'vitest';
import { bookingGuestEditable } from '../../apps/web/src/app/reservations/[number]/guest-editor-access';
const desk = { access: { role: 'STAFF' as const, platform: false, aiSeller: false }, readOnly: false, scopeKey: 'synthetic:branch' };
it('allows only known scoped desk writers at organization level', () => {
  expect(bookingGuestEditable(desk)).toBe(true);
  expect(bookingGuestEditable({ ...desk, readOnly: true })).toBe(false);
  expect(bookingGuestEditable({ ...desk, access: { ...desk.access, restricted: true } })).toBe(false);
  expect(bookingGuestEditable({ ...desk, access: { ...desk.access, unknown: true } })).toBe(false);
  expect(bookingGuestEditable({ access: desk.access, readOnly: desk.readOnly })).toBe(false);
});
const update = vi.hoisted(() => vi.fn());
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('../../apps/web/src/lib/api', async () => ({ ApiError: (await import('../../apps/web/src/lib/api-error')).ApiError, guestsApi: { update } }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
import { updateGuestAction } from '../../apps/web/src/app/guests/[id]/actions';
it('revalidates booking cards while sending only submitted original guest fields', async () => {
  const fd = new FormData(); fd.set('citizenship', 'KGZ'); fd.set('nightPrice', '999');
  // метка успеха: окно «Изменить гостя» закрывается по ней (аудит 22.10.2026 P2-3)
  await expect(updateGuestAction('synthetic-id', { error: null }, fd)).resolves.toEqual({
    error: null,
    saved: expect.any(Number),
  });
  expect(update).toHaveBeenCalledWith('synthetic-id', { citizenship: 'KGZ' });
  expect(revalidate).toHaveBeenCalledWith('/reservations/[number]', 'page');
});
