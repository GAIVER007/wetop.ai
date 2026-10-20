'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { parseEmployeeInput, type PersonnelKind } from '@pms/domain';
import type { BeautyEmployeeRow } from '../../lib/api';
import { loadBeautyEmployee, saveBeautyEmployee } from '../../app/beauty/actions';
import { useCreationKey } from '../../app/beauty/creation-key';
import { EmployeeBasicForm, type EmployeeProfileDraft } from './basic-form';
import { Overlay } from '../overlay';
import { Alert, Button } from '../ui';
import { rovingIndex } from '../tabs';
import './workspace.css';

const fields = (row: BeautyEmployeeRow | null): EmployeeProfileDraft => ({
  name: row?.name ?? '',
  phone: row?.phone ?? '',
  email: row?.email ?? '',
  active: row?.active ?? true,
});
export function EmployeeProfile({
  row,
  scopeKey,
  canEdit,
  onSaved,
  onCancelCreate,
}: {
  row: BeautyEmployeeRow | null;
  scopeKey: string;
  canEdit: boolean;
  onSaved: (row: BeautyEmployeeRow) => void;
  onCancelCreate?: () => void;
}) {
  const [original, setOriginal] = useState(() => fields(row));
  const [draft, setDraft] = useState(original);
  const [revision, setRevision] = useState(row?.profileRevision);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<BeautyEmployeeRow | null>(null);
  const [pending, setPending] = useState(false);
  // по умолчанию «Специалист»: руководитель видит выбор и может сменить его до создания
  const [personnelKind, setPersonnelKind] = useState<PersonnelKind>('SPECIALIST');
  const form = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  const busy = useRef(false);
  const requestVersion = useRef(0);
  const creation = useCreationKey(scopeKey, 'employee', Boolean(row));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const switched = () => {
      requestVersion.current++;
      setPending(false);
      setError('Филиал изменяется. Ответ прежнего запроса не будет применён к форме.');
    };
    window.addEventListener('wetop-scope-switch', switched);
    return () => window.removeEventListener('wetop-scope-switch', switched);
  }, []);
  useEffect(() => {
    if (error) form.current?.querySelector<HTMLElement>('[data-employee-error]')?.focus();
  }, [error, current]);
  const finish = (success: boolean, saved?: EmployeeProfileDraft) => {
    const element = form.current;
    element?.dispatchEvent(
      new CustomEvent('employee-save-result', {
        bubbles: true,
        detail: {
          success,
          snapshot: saved ? employeeFormSignature(element, saved) : undefined,
        },
      }),
    );
  };
  const save = async () => {
    if (busy.current || !canEdit || current) {
      finish(false);
      return;
    }
    const parsed = parseEmployeeInput(draft);
    if (!parsed.ok) {
      setError(parsed.reason);
      finish(false);
      return;
    }
    if (row && !revision) {
      setError('Обновите профиль через «Отмена» перед сохранением.');
      finish(false);
      return;
    }
    if (!row && !creation.id) {
      setError(creation.error || 'Подготавливаем создание.');
      finish(false);
      return;
    }
    const version = ++requestVersion.current;
    busy.current = true;
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set('section', 'basic');
    data.set('scopeKey', scopeKey);
    data.set('activePresent', '1');
    for (const key of ['name', 'phone', 'email'] as const) data.set(key, draft[key]);
    if (draft.active) data.set('active', 'on');
    if (row) {
      data.set('id', row.id);
      data.set('expectedProfileRevision', revision!);
      data.set(
        'changedFields',
        JSON.stringify(
          (Object.keys(draft) as Array<keyof EmployeeProfileDraft>).filter(
            (key) => draft[key] !== original[key],
          ),
        ),
      );
    } else {
      data.set('creationId', creation.id);
      data.set('personnelKind', personnelKind);
    }
    try {
      const result = await saveBeautyEmployee(null, data);
      if (!alive.current || version !== requestVersion.current) return;
      if (result.error || !result.employee) {
        setError(result.error || 'Не удалось получить сохранённый профиль. Повторите сохранение.');
        setCurrent(result.currentEmployee ?? null);
        finish(false);
        return;
      }
      const saved = result.employee;
      setDraft(fields(saved));
      setOriginal(fields(saved));
      setRevision(saved.profileRevision);
      creation.clear();
      finish(true, fields(saved));
      onSaved(saved);
    } catch {
      if (alive.current && version === requestVersion.current) {
        setError(
          'Не удалось подтвердить сохранение. Ваш ввод сохранён в форме. Повторите попытку.',
        );
        finish(false);
      }
    } finally {
      busy.current = false;
      if (alive.current && version === requestVersion.current) setPending(false);
    }
  };
  const cancel = async () => {
    if (!row) {
      setDraft(fields(null));
      setOriginal(fields(null));
      setError(null);
      setCurrent(null);
      finish(true, fields(null));
      return;
    }
    setPending(true);
    const version = ++requestVersion.current;
    try {
      const result = await loadBeautyEmployee(row.id);
      if (!alive.current || version !== requestVersion.current) return;
      if (!result.employee || result.locationId !== scopeKey) {
        setError(result.error || 'Филиал изменён. Откройте профиль в текущем филиале.');
        return;
      }
      setDraft(fields(result.employee));
      setOriginal(fields(result.employee));
      setRevision(result.employee.profileRevision);
      setCurrent(null);
      setError(null);
      finish(true, fields(result.employee));
    } catch {
      if (alive.current && version === requestVersion.current)
        setError('Не удалось обновить профиль. Черновик сохранён, повторите загрузку.');
    } finally {
      if (alive.current && version === requestVersion.current) setPending(false);
    }
  };
  return (
    <>
      <EmployeeBasicForm
        draft={draft}
        onChange={setDraft}
        onSave={(event) => {
          event.preventDefault();
          void save();
        }}
        onCancel={() => {
          if (!row && onCancelCreate) onCancelCreate();
          else void cancel();
        }}
        creating={!row}
        pending={pending}
        disabled={!canEdit}
        error={error || creation.error || null}
        current={current ? fields(current) : null}
        formRef={form}
        {...(row ? {} : { personnelKind, onPersonnelKindChange: setPersonnelKind })}
      />
    </>
  );
}

// Compare visible editable controls, without tokens, hidden identity fields or contact storage.
export function employeeFormSignature(form: HTMLFormElement, saved?: EmployeeProfileDraft) {
  return JSON.stringify(
    Array.from(form.elements).flatMap((control) => {
      if (!(
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      ))
        return [];
      if (
        control instanceof HTMLInputElement &&
        ['hidden', 'submit', 'button'].includes(control.type)
      )
        return [];
      return [
        [
          control.name,
          saved && Object.hasOwn(saved, control.name)
            ? saved[control.name as keyof EmployeeProfileDraft]
            : control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)
              ? control.checked
              : control.value,
        ],
      ];
    }),
  );
}
function saveSignal(event: Event): { success: boolean; snapshot?: string; reset?: boolean } {
  const detail = (
    event as CustomEvent<boolean | { success: boolean; snapshot?: string; reset?: boolean }>
  ).detail;
  return typeof detail === 'boolean' ? { success: detail } : detail;
}
export function EmployeeTransitionGuard({
  children,
  register,
  discard,
}: {
  children: ReactNode;
  register: (request: (action: () => void) => void) => void;
  discard: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const baselines = useRef(new WeakMap<HTMLFormElement, string>());
  const submitted = useRef(new WeakMap<HTMLFormElement, string>());
  const [destination, setDestination] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bypass = useRef(false);
  const dirty = useCallback(
    () =>
      Array.from(root.current?.querySelectorAll('form') ?? []).filter(
        (form) =>
          baselines.current.has(form) &&
          baselines.current.get(form) !== employeeFormSignature(form),
      ),
    [],
  );
  const request = useCallback(
    (action: () => void) => {
      if (dirty().length === 0) {
        action();
        return;
      }
      setError('');
      setDestination(() => action);
    },
    [dirty],
  );
  useEffect(() => {
    register(request);
  }, [register, request]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const initialize = () =>
      element.querySelectorAll<HTMLFormElement>('form[data-employee-transition-form]').forEach((form) => {
        if (!baselines.current.has(form)) {
          baselines.current.set(form, employeeFormSignature(form));
        }
      });
    initialize();
    const observer = new MutationObserver(initialize);
    observer.observe(element, { childList: true, subtree: true });
    const saved = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      const result = saveSignal(event);
      if (result.success) {
        baselines.current.set(
          form,
          result.snapshot ?? submitted.current.get(form) ?? employeeFormSignature(form),
        );
        if (result.reset) {
          requestAnimationFrame(() => baselines.current.set(form, employeeFormSignature(form)));
        }
      }
      submitted.current.delete(form);
    };
    element.addEventListener('employee-save-result', saved);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty().length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    // Intercept application links and scope controls before their handlers change context.
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
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('a[href], .branch-switcher__options button');
      if (!control || control.closest('[data-employee-confirm]') || !dirty().length) return;
      if (
        control instanceof HTMLAnchorElement &&
        (control.target === '_blank' || control.origin !== location.origin)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      request(() => {
        bypass.current = true;
        control.click();
        bypass.current = false;
      });
    };
    document.addEventListener('click', click, true);
    return () => {
      observer.disconnect();
      element.removeEventListener('employee-save-result', saved);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
    };
  }, [dirty, request]);
  const submit = (form: HTMLFormElement) =>
    new Promise<boolean>((resolve) => {
      if (!form.reportValidity()) {
        resolve(false);
        return;
      }
      let settled = false;
      const done = (success: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        observer.disconnect();
        form.removeEventListener('employee-save-result', result);
        resolve(success);
      };
      const result = (event: Event) => done(saveSignal(event).success);
      const previousError = form.querySelector('[role="alert"]')?.textContent;
      const observer = new MutationObserver(() => {
        const message = form.querySelector('[role="alert"]')?.textContent;
        if (message && message !== previousError) done(false);
      });
      observer.observe(form, { childList: true, subtree: true, characterData: true });
      const timeout = setTimeout(() => done(false), 20000);
      form.addEventListener('employee-save-result', result);
      form.requestSubmit();
    });
  const leave = async () => {
    setSaving(true);
    setError('');
    for (const form of dirty()) {
      if (!(await submit(form))) {
        setSaving(false);
        setError('Сохранение не завершено. Исправьте ошибку в форме или оставайтесь в карточке.');
        return;
      }
    }
    setSaving(false);
    const action = destination;
    setDestination(null);
    requestAnimationFrame(() => action?.());
  };
  return (
    <div
      ref={root}
      onSubmitCapture={(event) => {
        if (event.target instanceof HTMLFormElement)
          submitted.current.set(event.target, employeeFormSignature(event.target));
      }}
      onClickCapture={(event) => {
        if (bypass.current) return;
        const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]');
        if (!tab || tab.getAttribute('aria-selected') === 'true' || !dirty().length) return;
        event.preventDefault();
        event.stopPropagation();
        const index = Array.from(root.current!.querySelectorAll('[role="tab"]')).indexOf(tab);
        request(() =>
          requestAnimationFrame(() => {
            bypass.current = true;
            root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.click();
            bypass.current = false;
          }),
        );
      }}
      onKeyDownCapture={(event) => {
        if (bypass.current || !dirty().length) return;
        const tabs = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
        );
        const index = tabs.indexOf(event.target as HTMLButtonElement);
        const next = index < 0 ? -1 : rovingIndex(event.key, index, tabs.length);
        if (next < 0) return;
        event.preventDefault();
        event.stopPropagation();
        request(() =>
          requestAnimationFrame(() => {
            bypass.current = true;
            const target = root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
            target?.click();
            target?.focus();
            bypass.current = false;
          }),
        );
      }}
    >
      {children}
      <Overlay
        open={Boolean(destination)}
        onClose={() => {
          if (!saving) setDestination(null);
        }}
        title="Несохранённые изменения"
        trapFocus
        size="sm"
      >
        <div data-employee-confirm>
          <p>Сохранить изменения перед переходом?</p>
          {error && <Alert>{error}</Alert>}
          <div className="employee-workspace-actions">
            <Button
              disabled={saving}
              onClick={() => {
                void leave();
              }}
            >
              {saving ? 'Сохраняем…' : 'Сохранить и перейти'}
            </Button>
            <Button
              tone="secondary"
              disabled={saving}
              onClick={() => {
                const action = destination;
                setDestination(null);
                dirty().forEach((form) =>
                  baselines.current.set(form, employeeFormSignature(form)),
                );
                discard();
                action?.();
              }}
            >
              Не сохранять
            </Button>
            <Button tone="secondary" disabled={saving} onClick={() => setDestination(null)}>
              Остаться
            </Button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}
