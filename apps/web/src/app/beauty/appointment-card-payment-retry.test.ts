import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[], cleanups: [] as (() => void)[], tasks: [] as Promise<unknown>[], pay: vi.fn(), refund: vi.fn() }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial; return [h.slots[i], (value: unknown) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }]; },
    useRef: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++; const old = h.slots[i] as unknown[] | undefined; if (!old || deps.some((x, j) => x !== old[j])) { h.slots[i] = deps; h.effects.push(() => { const cleanup = effect(); if (cleanup) h.cleanups.push(cleanup); }); } },
    useActionState: () => [null, vi.fn(), false],
    useTransition: () => [false, (callback: () => unknown) => { h.tasks.push(Promise.resolve(callback())); }],
  };
});
vi.mock('./journal-actions', () => ({ moveAppointment: vi.fn(), payAppointment: h.pay, refundAppointment: h.refund, setAppointmentStatus: vi.fn() }));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
import { AppointmentCard } from './appointment-card';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
const scopeKey = JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' });
const row = { id: 'appointment', employeeId: 'employee', serviceId: 'service', serviceName: 'Тест', customer: { id: 'customer', name: 'Тестовый клиент', phone: null }, startsAt: '2026-10-18T13:00:00Z', endsAt: '2026-10-18T14:00:00Z', startMinutes: 1080, endMinutes: 1140, status: 'DONE', next: [], priceMinor: '800000', paidMinor: '300000', refundedMinor: '0', currency: 'KZT', notes: null } satisfies BeautyAppointmentRow;
const day = { location: { id: 'location', name: 'Тестовый салон', timezone: 'Asia/Almaty', currency: 'KZT' }, date: '2026-10-18', columns: [], appointments: [row], services: [], bounds: { fromMinutes: 480, toMinutes: 1200 } } satisfies BeautyDay;
type Node = { type?: unknown; props?: Record<string, unknown> };
const nodes = (tree: unknown): Node[] => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree as Node, ...nodes((tree as Node).props?.children)] : [];
const text = (tree: unknown): string => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text((tree as Node).props?.children) : String(tree ?? '');
const done = vi.fn();
function render() {
  h.cursor = 0;
  let tree: unknown = AppointmentCard({ row, day, scopeKey, canPay: true, canRefund: true, onDone: done });
  // A keyed inner body may reset hooks in real React. This harness exercises its real handlers,
  // not DOM behavior; browser proof remains a separate requirement.
  if (tree && typeof (tree as Node).type === 'function') tree = ((tree as Node).type as (p: unknown) => unknown)((tree as Node).props);
  const effects = h.effects.splice(0); effects.forEach((effect) => effect());
  return tree;
}
function button(tree: unknown, label: string) {
  const node = nodes(tree).find((x) => x.props?.onClick && text(x).includes(label));
  expect(node, `button ${label}`).toBeTruthy(); return node!.props!;
}
function input(tree: unknown, fieldLabel: string) {
  const field = nodes(tree).find((x) => x.props?.label === fieldLabel);
  const node = nodes(field?.props?.children).find((x) => typeof x.props?.onChange === 'function');
  expect(node, `input ${fieldLabel}`).toBeTruthy(); return node!.props!;
}
const settle = async () => { await Promise.all(h.tasks.splice(0)); };
beforeEach(() => {
  h.slots = []; h.cursor = 0; h.effects = []; h.cleanups = []; h.tasks = []; vi.resetAllMocks();
  const data = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});
afterEach(() => { h.cleanups.forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });
describe('real AppointmentCard handlers with deterministic hook harness (not browser)', () => {
  it('retains partial-payment identity after thrown response and explicitly retries exact payload', async () => {
    h.pay.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ message: 'Оплата принята' });
    render(); let tree = render();
    (input(tree, 'Сумма, ₸').onChange as (e: unknown) => void)({ target: { value: '3000' } }); tree = render();
    const click = button(tree, 'Принять оплату').onClick as () => void;
    click(); click(); await settle(); expect(h.pay).toHaveBeenCalledTimes(1); expect(done).not.toHaveBeenCalled();
    tree = render(); expect(input(tree, 'Сумма, ₸').disabled).toBe(true);
    (button(tree, 'Повторить ту же операцию').onClick as () => void)(); await settle();
    expect(h.pay).toHaveBeenCalledTimes(2); expect(h.pay.mock.calls[1]).toEqual(h.pay.mock.calls[0]);
    expect(h.pay.mock.calls[0]?.slice(0, 3)).toEqual(['appointment', 'CASH', 300000]); expect(done).toHaveBeenCalledTimes(1);
  });
  it('freezes trimmed refund reason on returned legacy error and retries without new identity', async () => {
    h.refund.mockResolvedValueOnce({ error: 'Unknown response' }).mockResolvedValueOnce({ message: 'Возврат оформлен' });
    render(); let tree = render();
    (input(tree, 'Причина').onChange as (e: unknown) => void)({ target: { value: '  Тестовая причина  ' } }); tree = render();
    (button(tree, 'Оформить возврат').onClick as () => void)(); await settle(); tree = render();
    expect(input(tree, 'Причина').disabled).toBe(true);
    (button(tree, 'Повторить ту же операцию').onClick as () => void)(); await settle();
    expect(h.refund.mock.calls[1]).toEqual(h.refund.mock.calls[0]); expect(h.refund.mock.calls[0]?.[3]).toBe('Тестовая причина');
  });
  it('reopened unresolved form cannot send a replacement operation', async () => {
    h.pay.mockResolvedValue({ error: 'Unknown' }); render(); let tree = render();
    (button(tree, 'Принять оплату').onClick as () => void)(); await settle();
    h.cleanups.forEach((cleanup) => cleanup()); h.cleanups = []; h.slots = [];
    render(); tree = render(); expect(button(tree, 'Принять оплату').disabled).toBe(true);
    expect(text(tree)).toContain('Сверьте историю и кассу'); expect(h.pay).toHaveBeenCalledTimes(1);
  });
  it('unmounted card ignores late confirmed completion callback', async () => {
    let resolve!: (value: unknown) => void; h.pay.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(); const tree = render(); (button(tree, 'Принять оплату').onClick as () => void)();
    h.cleanups.forEach((cleanup) => cleanup()); resolve({ message: 'Оплата принята' }); await settle();
    expect(done).not.toHaveBeenCalled();
  });
});
