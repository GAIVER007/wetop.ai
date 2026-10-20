import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BeautyEmployeeRow } from '../../../lib/api';

const captured = vi.hoisted(() => ({
  buttons: [] as Array<{ children?: unknown; onClick?: () => void }>,
  close: () => {},
  replace: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useTransition: () => [false, (action: () => void) => action()],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: captured.replace }) }));
vi.mock('../../../components/ui', () => ({
  Button: (props: { children?: unknown; onClick?: () => void }) => {
    captured.buttons.push(props);
    return null;
  },
  Alert: () => null,
  Badge: () => null,
}));
vi.mock('../../../components/overlay', () => ({
  Overlay: (props: { onClose: () => void }) => {
    captured.close = props.onClose;
    return null;
  },
}));
vi.mock('../../../components/employee-workspace/workspace', () => ({
  EmployeeProfile: () => null,
  EmployeeTransitionGuard: () => null,
}));
vi.mock('../schedule/board', () => ({}));
vi.mock('../actions', () => ({ loadBeautySchedule: async () => ({ data: null }) }));
import { MastersBoard } from './board';

// Exercise the installed Next wrappers, including their internal-state early return.
// The native browser writes and router restore are boundaries, not a full browser proof.
function historyHarness() {
  let href = 'http://example.test/employees?onboarding=1&employee=A#profile';
  let canonical = href;
  const tree = { fixture: 'router-tree' };
  const entries: Array<{ url: string; state: Record<string, unknown> }> = [];
  const history = { state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree } as Record<string, unknown> };
  const nativeWrite = (data: Record<string, unknown>, _unused: string, url: string | URL) => {
    href = new URL(url, href).href;
    history.state = data;
    entries.push({ url: href, state: data });
  };
  const require = createRequire(import.meta.url);
  const source = readFileSync(require.resolve('next/dist/client/components/app-router.js'), 'utf8');
  const start = source.indexOf('window.history.pushState = function pushState');
  const end = source.indexOf('/**\n     * Handle popstate', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const window = { history, dispatchEvent: vi.fn() };
  new Function('window', 'originalPushState', 'originalReplaceState',
    'copyNextJsInternalHistoryState', 'applyUrlFromHistoryPushReplace', source.slice(start, end))(
    window, nativeWrite, nativeWrite,
    (data: Record<string, unknown>) => ({ ...data, __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree }),
    (url: string | URL) => { canonical = new URL(url, href).href; },
  );
  vi.stubGlobal('location', { get href() { return href; } });
  vi.stubGlobal('history', history);
  vi.stubGlobal('window', window);
  return { entries, href: () => href, canonical: () => canonical };
}

function board() {
  captured.buttons = [];
  captured.replace.mockClear();
  const row = (id: string): BeautyEmployeeRow => ({
    id, name: id, phone: null, email: null, active: true, serviceIds: [], locationIds: [],
  });
  renderToStaticMarkup(createElement(MastersBoard, {
    items: [row('A'), row('B')], services: [], canEdit: true, locations: [],
    today: { columns: [], appointments: [] } as unknown as BeautyDay,
  }));
  const opens = captured.buttons.filter((button) => button.children === 'Открыть');
  return { openA: () => opens[0]!.onClick!(), openB: () => opens[1]!.onClick!() };
}

afterEach(() => vi.unstubAllGlobals());
describe('Employee address native-history integration', () => {
  it('opening B updates the Next canonical address and keeps history position', () => {
    const h = historyHarness();
    board().openB();
    expect(new URL(h.canonical()).searchParams.get('employee')).toBe('B');
    expect(h.entries.at(-1)?.state.peoplePosition).toBe(1);
    expect(h.entries.at(-1)?.state.__NA).toBe(true);
    expect(h.entries.at(-1)?.state.__PRIVATE_NEXTJS_INTERNALS_TREE).toEqual({ fixture: 'router-tree' });
  });
  it('closing updates the server-action address without a deferred list navigation (O07c)', () => {
    const h = historyHarness();
    board();
    captured.close();
    expect(new URL(h.canonical()).searchParams.get('employee')).toBeNull();
    expect(new URL(h.canonical()).searchParams.get('onboarding')).toBe('1');
    expect(captured.replace).not.toHaveBeenCalled();
  });
  it('close A then open B cannot leave a list navigation to clear the B address', () => {
    const h = historyHarness();
    const b = board();
    b.openA();
    captured.close();
    b.openB();
    // A selected-card navigation is valid; only a deferred list navigation can clear B.
    const targets = captured.replace.mock.calls.map(([url]) =>
      new URL(String(url), h.href()).searchParams.get('employee'),
    );
    expect(targets).not.toContain(null);
    if (targets.length) expect(targets.at(-1)).toBe('B');
    expect(h.canonical()).toBe(h.href());
    expect(new URL(h.canonical()).searchParams.get('employee')).toBe('B');
    expect(h.entries.at(-1)?.state.peoplePosition).toBe(2);
  });
});
