import { beforeEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
const mocks = vi.hoisted(() => ({ pay: vi.fn(), refund: vi.fn(), me: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('../../lib/api', () => ({
  ApiError: class extends Error {},
  authApi: { me: mocks.me },
  beautyApi: { payAppointment: mocks.pay, refundAppointment: mocks.refund },
}));
import { payAppointment, refundAppointment } from './journal-actions';
const scope = JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' });
const confirmation = { appointments: [{ id: 'appointment' }] };
const cases = [
  { kind: 'payment', mock: mocks.pay, run: () => payAppointment('appointment', 'CASH', 300000, 'key', scope) },
  { kind: 'refund', mock: mocks.refund, run: () => refundAppointment('appointment', 'CARD', 100000, 'Причина', 'key', scope) },
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.me.mockResolvedValue({ user: { organizationId: 'org' }, context: { businessId: 'business', locationId: 'location' } });
});
for (const c of cases) describe(`${c.kind} action confirmation boundary`, () => {
  it('rejects changed scope before zero mutation calls', async () => {
    mocks.me.mockResolvedValue({ user: { organizationId: 'another' }, context: { businessId: 'business', locationId: 'location' } });
    expect(await c.run()).toMatchObject({ outcome: 'rejected' }); expect(c.mock).not.toHaveBeenCalled();
  });
  it('rejects failed preflight without dispatch', async () => {
    mocks.me.mockRejectedValue(new Error('Expired session'));
    expect(await c.run()).toMatchObject({ outcome: 'rejected' }); expect(c.mock).not.toHaveBeenCalled();
  });
  it.each([400, 403, 503])('keeps post-dispatch status %s unknown, not safe to resend with fresh key', async (status) => {
    c.mock.mockRejectedValue(Object.assign(new Error('Response failed after possible commit'), { status }));
    expect(await c.run()).toMatchObject({ outcome: 'unknown' }); expect(c.mock).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, {}, { appointments: [] }])('does not fabricate confirmation from %j', async (response) => {
    c.mock.mockResolvedValue(response); expect(await c.run()).toMatchObject({ outcome: 'unknown' });
  });
  it('does not call confirmed mutation failed if cache revalidation fails', async () => {
    c.mock.mockResolvedValue(confirmation); mocks.revalidate.mockImplementation(() => { throw new Error('Cache error'); });
    const result = await c.run(); expect(result.message).toBeTruthy(); expect(result.error).toBeUndefined();
    expect(result.outcome).toBeUndefined(); expect(c.mock).toHaveBeenCalledTimes(1);
  });
  it('returns success only on actual matching appointment confirmation', async () => {
    c.mock.mockResolvedValue(confirmation); expect(await c.run()).toEqual({ message: c.kind === 'payment' ? 'Оплата принята' : 'Возврат оформлен' });
  });
});
