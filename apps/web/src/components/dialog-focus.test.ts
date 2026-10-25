import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';
import * as overlay from './overlay';

// The unit project runs in Node. Only hook lifecycle and browser layout/focus APIs are
// supplied here; the production key handler runs unchanged. Real Tab is covered in UI QA.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: () => undefined,
  useId: () => 'dialog-title',
  useRef: () => ({ current: null }),
}));

// Компонент вызывается как функция вне отрисовки: язык человека подставляется без контекста (русский)
vi.mock('../i18n/locale-provider', async (importOriginal) => {
  const { translator } = await import('../i18n');
  return { ...(await importOriginal<object>()), useT: () => translator('ru'), useLocale: () => 'ru' };
});

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const doc: { activeElement: unknown } = { activeElement: null };
  vi.stubGlobal('document', doc);
  function control({ visible = true, inert = false } = {}) {
    const node = {
      getClientRects: () => (visible ? [{}] : []),
      closest: (selector: string) => (selector === '[inert]' && inert ? {} : null),
      focus: vi.fn(() => {
        doc.activeElement = node;
      }),
    };
    return node;
  }
  const first = control();
  const middle = control();
  const last = control();
  const querySelectorAll = vi.fn(() => [first, middle, last]);
  const dialog = { querySelectorAll };
  const target = { closest: vi.fn(() => dialog) };
  function event(key = 'Tab', shiftKey = false) {
    const preventDefault = vi.fn();
    return {
      key,
      shiftKey,
      currentTarget: dialog,
      target,
      preventDefault,
    } as unknown as ReactKeyboardEvent<HTMLDialogElement>;
  }
  return { doc, control, first, middle, last, querySelectorAll, dialog, target, event };
}

function confirm() {
  return ConfirmDialog({
    open: true,
    title: 'Discard draft?',
    confirmLabel: 'Discard',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  });
}

describe('ConfirmDialog focus regression', () => {
  it('wraps Tab from Confirm back to Cancel instead of allowing focus to leave', () => {
    const f = fixture();
    f.doc.activeElement = f.last;
    const e = f.event();
    confirm().props.onKeyDown?.(e);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(f.first);
  });

  it('uses the shared Overlay focus handler directly', () => {
    expect(confirm().props.onKeyDown).toBeTypeOf('function');
    expect(confirm().props.onKeyDown).toBe(overlay.trapDialogFocus);
  });
});

describe('trapDialogFocus', () => {
  it('wraps forward from the last visible control', () => {
    const f = fixture();
    f.doc.activeElement = f.last;
    const e = f.event();
    overlay.trapDialogFocus(e);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(f.first.focus).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(f.first);
  });

  it('wraps backward from the first visible control', () => {
    const f = fixture();
    f.doc.activeElement = f.first;
    const e = f.event('Tab', true);
    overlay.trapDialogFocus(e);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(f.last.focus).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(f.last);
  });

  it.each([false, true])('leaves middle-control Tab unchanged (shift=%s)', (shift) => {
    const f = fixture();
    f.doc.activeElement = f.middle;
    const e = f.event('Tab', shift);
    overlay.trapDialogFocus(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(f.doc.activeElement).toBe(f.middle);
    expect(f.first.focus).not.toHaveBeenCalled();
    expect(f.last.focus).not.toHaveBeenCalled();
  });

  it.each(['Escape', 'Enter', 'ArrowDown'])('does not handle %s', (key) => {
    const f = fixture();
    f.doc.activeElement = f.last;
    const e = f.event(key);
    overlay.trapDialogFocus(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(f.querySelectorAll).not.toHaveBeenCalled();
    expect(f.doc.activeElement).toBe(f.last);
  });

  it.each([false, true])(
    'excludes hidden and inert controls from both boundaries (shift=%s)',
    (shift) => {
      const f = fixture();
      const hidden = f.control({ visible: false });
      const inert = f.control({ inert: true });
      f.querySelectorAll.mockReturnValue([hidden, inert, f.first, f.last, inert, hidden]);
      f.doc.activeElement = shift ? f.first : f.last;
      const e = f.event('Tab', shift);
      overlay.trapDialogFocus(e);
      expect(e.preventDefault).toHaveBeenCalledOnce();
      expect(f.doc.activeElement).toBe(shift ? f.last : f.first);
      expect(hidden.focus).not.toHaveBeenCalled();
      expect(inert.focus).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('prevents escape when no eligible controls exist (shift=%s)', (shift) => {
    const f = fixture();
    f.querySelectorAll.mockReturnValue([f.control({ visible: false }), f.control({ inert: true })]);
    const e = f.event('Tab', shift);
    overlay.trapDialogFocus(e);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBeNull();
  });

  it('ignores a key event belonging to a nested dialog', () => {
    const f = fixture();
    f.target.closest.mockReturnValue({ querySelectorAll: vi.fn() });
    f.doc.activeElement = f.last;
    const e = f.event();
    overlay.trapDialogFocus(e);
    expect(f.target.closest).toHaveBeenCalledWith('dialog');
    expect(f.querySelectorAll).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(f.doc.activeElement).toBe(f.last);
  });
});

describe('Overlay trapFocus remains opt-in', () => {
  it.each([false, true])('handles Tab only when trapFocus=%s', (trapFocus) => {
    const f = fixture();
    f.doc.activeElement = f.last;
    const e = f.event();
    overlay
      .Overlay({ open: true, title: 'Panel', children: null, onClose: vi.fn(), trapFocus })
      .props.onKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalledTimes(trapFocus ? 1 : 0);
    expect(f.doc.activeElement).toBe(trapFocus ? f.first : f.last);
  });

  it('does not close the parent Overlay for a nested dialog cancel', () => {
    const onClose = vi.fn();
    const preventDefault = vi.fn();
    overlay
      .Overlay({ open: true, title: 'Panel', children: null, onClose })
      .props.onCancel({ target: {}, currentTarget: {}, preventDefault });
    expect(onClose).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
