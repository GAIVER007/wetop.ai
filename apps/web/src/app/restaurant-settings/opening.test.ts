import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpeningForm } from './opening-form';
import { openingInput, openingDraft } from './opening-input';
import { afterEach } from 'vitest';
afterEach(() => { delete process.env.RESTAURANT_CAPACITY_CAPTURE; delete process.env.RESTAURANT_OCCUPANCY_CAPTURE; });
import { saveOpening, loadOpening } from './opening-actions';
import { openingApi } from '../../lib/opening-api';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: vi.fn(async () => ({ user: { id: 'u' }, context: { vertical: 'FOOD_SERVICE', businessId: 'b', locationId: 'l' } })), deskShell: vi.fn(async () => ({ access: { property: true }, readOnly: false })) }));
vi.mock('../../lib/navigation', () => ({ mayAccess: () => true }));
vi.mock('../../lib/opening-api', () => ({ openingApi: { read: vi.fn(), confirm: vi.fn() } }));
const input = { effectiveFrom: '2026-10-16', effectiveTo: '2026-10-17', intervals: [{ weekday: 5, localStart: '18:00', localEnd: '02:00', endsNextDay: true }], closures: [{ day: '2026-10-17', reason: 'Ремонт' }] };
beforeEach(() => { vi.clearAllMocks(); process.env.RESTAURANT_CAPACITY_CAPTURE = 'true'; process.env.RESTAURANT_OCCUPANCY_CAPTURE = 'true'; });
it('renders physical empty state and explicit confirmation, not booking fallback', () => {
 const html = renderToStaticMarkup(React.createElement(OpeningForm, { scopeKey: 'b:l', timezone: 'UTC', write: true, initial: { enabled: true, schedule: null } }));
 expect(html).toContain('Часы работы зала'); expect(html).toContain('Расписание не подтверждено'); expect(html).toContain('Подтверждаю физические часы'); expect(html).not.toContain('value="10:00"');
});
it('validates explicit rollover, date and closure reason', () => {
 expect(openingInput(input)).toEqual(input);
 expect(() => openingInput({ ...input, intervals: [{ ...input.intervals[0]!, endsNextDay: false }] })).toThrow();
 expect(() => openingInput({ ...input, effectiveFrom: '2026-02-30' })).toThrow();
 expect(() => openingInput({ ...input, closures: [{ day: '2026-10-17', reason: '' }] })).toThrow();
});
it('disabled flags do not call absent API', async () => {
 delete process.env.RESTAURANT_CAPACITY_CAPTURE;
 expect((await loadOpening()).enabled).toBe(false);
 expect((await saveOpening('b:l', input, true)).error).toBeTruthy();
 expect(openingApi.read).not.toHaveBeenCalled(); expect(openingApi.confirm).not.toHaveBeenCalled();
});
it('requires confirmation and selected restaurant, sends exact full replacement once', async () => {
 expect((await saveOpening('b:l', input, false)).error).toBeTruthy();
 expect((await saveOpening('other', input, true)).error).toBeTruthy();
 vi.mocked(openingApi.confirm).mockResolvedValue({ id: 'revision' });
 expect((await saveOpening('b:l', input, true)).error).toBeNull();
 expect(openingApi.confirm).toHaveBeenCalledExactlyOnceWith(input);
});
it('reload maps the actual snake_case GET fields without booking defaults', async () => {
 const row = { id:'r',area_id:null,timezone:'UTC',effective_from:'2026-10-16T00:00:00.000Z',effective_to:'2026-10-17T00:00:00.000Z',recorded_at:'2026-10-16T11:00:00Z',intervals:[{weekday:5,local_start:'18:00:00',local_end:'02:00:00',ends_next_day:true}],closures:[{day:'2026-10-17',reason:'Ремонт'}] };
 vi.mocked(openingApi.read).mockResolvedValue([row]);
 const state = await loadOpening(); expect(openingDraft(state.schedule)).toEqual(input);
 const html = renderToStaticMarkup(React.createElement(OpeningForm,{scopeKey:'b:l',timezone:'UTC',write:true,initial:state}));
 expect(html).toContain('value="18:00"'); expect(html).toContain('Ремонт'); expect(html).toContain('observedAt');
});
it('server error returns inline failure without automatic retry', async () => {
 vi.mocked(openingApi.confirm).mockRejectedValue(new Error('LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS'));
 const result = await saveOpening('b:l', input, true);
 expect(result.error).toContain('часов'); expect(openingApi.confirm).toHaveBeenCalledTimes(1);
});
