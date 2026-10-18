'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Overlay } from '../../components/overlay';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AppointmentForm } from './appointment-form';

/** Opt-in only for new Beauty appointments. No PII is written outside this mounted form. */
export function AppointmentEditor({
  open,
  onClose,
  onDone,
  ...form
}: Omit<Parameters<typeof AppointmentForm>[0], 'onDone' | 'onStateChange'> & {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const status = useRef({ dirty: false, pending: false });
  const [destination, setDestination] = useState<(() => void) | null>(null);
  const bypass = useRef(false);
  const changed = useCallback((next: { dirty: boolean; pending: boolean }) => {
    status.current = next;
  }, []);
  const request = useCallback((action: () => void) => {
    if (status.current.pending) return;
    if (status.current.dirty) setDestination(() => action);
    else action();
  }, []);
  useEffect(() => {
    if (!open) {
      status.current = { dirty: false, pending: false };
      return;
    }
    const unload = (event: BeforeUnloadEvent) => {
      if (!status.current.dirty && !status.current.pending) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const click = (event: MouseEvent) => {
      if (
        bypass.current ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('a[href], .branch-switcher__options button')
          : null;
      if (!target || (target instanceof HTMLAnchorElement && target.target === '_blank')) return;
      if (!status.current.dirty && !status.current.pending) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      request(() => {
        bypass.current = true;
        target.click();
        bypass.current = false;
      });
    };
    // Restore a traversed entry before Next's popstate handler can unmount this form.
    // Navigation API supplies exact positions, but is not itself a reliable cancellation hook.
    const navigation = (
      window as unknown as {
        navigation?: EventTarget & {
          currentEntry?: { index: number };
          traverseTo: (key: string) => unknown;
        };
      }
    ).navigation;
    const position = navigation?.currentEntry?.index;
    let returning = false;
    let accepted = false;
    let delta = 0;
    const traverse = (event: Event) => {
      const e = event as Event & {
        navigationType: string;
        destination: { key: string; sameDocument: boolean };
      };
      if (
        accepted ||
        e.navigationType !== 'traverse' ||
        !e.cancelable ||
        !e.destination.sameDocument
      )
        return;
      if (!status.current.dirty && !status.current.pending) return;
      e.preventDefault();
      // Next also observes navigation. Do not let it restore a cached, pristine route behind the prompt.
      e.stopImmediatePropagation();
      request(() => {
        accepted = true;
        navigation?.traverseTo(e.destination.key);
      });
    };
    const pop = (event: PopStateEvent) => {
      if (accepted) {
        accepted = false;
        return;
      }
      if (returning) {
        event.stopImmediatePropagation();
        returning = false;
        request(() => {
          accepted = true;
          history.go(delta);
        });
        return;
      }
      if ((!status.current.dirty && !status.current.pending) || position === undefined) return;
      const at = navigation?.currentEntry?.index;
      if (at === undefined || at === position) return;
      delta = at - position;
      returning = true;
      event.stopImmediatePropagation();
      history.go(-delta);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', pop, true);
    navigation?.addEventListener('navigate', traverse, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', pop, true);
      navigation?.removeEventListener('navigate', traverse, true);
    };
  }, [open, request]);
  return (
    <Overlay
      open={open}
      onClose={() => request(onClose)}
      title={form.editing ? 'Изменить запись' : 'Новая запись'}
      size="lg"
      className="appointment-editor"
    >
      <AppointmentForm {...form} onStateChange={changed} onDone={onDone} />
      <ConfirmDialog
        open={destination !== null}
        title="Закрыть без сохранения?"
        confirmLabel="Закрыть без сохранения"
        cancelLabel="Продолжить заполнение"
        onCancel={() => setDestination(null)}
        onConfirm={() => {
          const action = destination;
          setDestination(null);
          status.current.dirty = false;
          // Next can reuse the list across dates. Destroy the discarded draft before navigating.
          onClose();
          if (action !== onClose) action?.();
        }}
      >
        Введённые данные будут потеряны. Запись не сохраняется при закрытии формы.
      </ConfirmDialog>
    </Overlay>
  );
}
