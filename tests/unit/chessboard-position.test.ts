import { afterEach, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }));
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }), useEffect: (fn: () => void) => hooks.effects.push(fn) }));
import { useBoardPosition, RESET_BOARD_POSITION } from '../../apps/web/src/app/chessboard/board-position';
afterEach(() => { hooks.effects = []; vi.unstubAllGlobals(); });
function setup(mobile = true) {
  const events = new Map<string, () => void>();
  const frames = new Map<number, () => void>();
  let seq = 0, x = 0;
  const table = { style: { marginInlineEnd: '7px' } };
  const units = { getBoundingClientRect: () => ({ right: 100, width: 100 }) };
  const today = { offsetLeft: 700, getBoundingClientRect: () => ({ left: 800 - x, width: 50 }) };
  const wrap = { clientWidth: 390, scrollTop: 0,
    get scrollLeft() { return x; }, set scrollLeft(value: number) { x = Math.min(value, 460 + parseFloat(table.style.marginInlineEnd)); },
    querySelector: (s: string) => s === 'table' ? table : s === 'thead th' ? units : today,
    querySelectorAll: () => ({ length: 1, item: () => today }),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
  const storage = { getItem: () => JSON.stringify({ x: 700, y: 280, page: 20 }), setItem: vi.fn() };
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: mobile }), scrollY: 20, scrollTo: vi.fn(), addEventListener: (s: string, fn: () => void) => events.set(s, fn), removeEventListener: (s: string) => events.delete(s) });
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { frames.set(++seq, fn); return seq; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  useBoardPosition({ current: wrap } as never, 'period', { query: '', filters: {} } as never, vi.fn());
  const cleanup = hooks.effects[0]!();
  const flush = () => { while (frames.size) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } };
  return { table, wrap, events, frames, storage, cleanup, flush };
}
it('reserves rendered last-day room before clamped saved restore and restores old margin on cleanup', () => {
  const s = setup();
  expect(s.table.style.marginInlineEnd).toBe('240px');
  s.flush();
  expect(s.wrap.scrollLeft).toBe(700);
  expect(s.wrap.scrollTop).toBe(280);
  s.cleanup?.();
  expect(s.table.style.marginInlineEnd).toBe('7px');
  expect(s.events.size).toBe(0);
});
it('Today cancels pending restore, aligns rendered rects, resets vertical and saves', () => {
  const s = setup();
  s.events.get(RESET_BOARD_POSITION)!();
  s.flush();
  expect(s.wrap.scrollLeft).toBe(700);
  expect(s.wrap.scrollTop).toBe(0);
  expect(s.frames.size).toBe(0);
  expect(s.storage.setItem).toHaveBeenCalled();
  s.cleanup?.();
});
it('desktop is untouched', () => {
  const s = setup(false);
  expect(s.table.style.marginInlineEnd).toBe('7px');
  expect(s.frames.size).toBe(0);
  expect(s.events.size).toBe(0);
});
