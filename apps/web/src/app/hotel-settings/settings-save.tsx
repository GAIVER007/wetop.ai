'use client';
import './settings.css';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button, cx } from '../../components/ui';

/**
 * Сохранение «Настроек объекта» из шапки экрана (ТЗ «Настройки объекта» v2 §10, ADR-115). Форма вкладки стоит ниже
 * шапки, поэтому кнопка отправляет её атрибутом `form`, а состояние приходит через этот контекст: пока ничего не
 * изменено — кнопка выключена; после правки — «Есть несохранённые изменения»; после ответа API — «Изменения
 * сохранены» строкой, без постоянной карточки. Ошибку показывает сама форма (`Alert` над полями).
 */
export const SETTINGS_FORM_ID = 'settings-form';

export interface SaveState {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
}
const IDLE: SaveState = { dirty: false, pending: false, saved: false };
const SaveContext = createContext<{
  state: SaveState;
  report: (next: SaveState) => void;
} | null>(null);

export function SettingsSave({ children }: { children: ReactNode }) {
  const [state, report] = useState<SaveState>(IDLE);
  return <SaveContext.Provider value={{ state, report }}>{children}</SaveContext.Provider>;
}

/** Форма вкладки сообщает шапке, что в ней происходит; ушла со страницы — шапка снова «ничего не изменено» */
export function useSaveReport({ dirty, pending, saved }: SaveState) {
  const report = useContext(SaveContext)?.report;
  useEffect(() => report?.({ dirty, pending, saved }), [report, dirty, pending, saved]);
  useEffect(() => () => report?.(IDLE), [report]);
}

export function SaveAction() {
  const { dirty, pending, saved } = useContext(SaveContext)?.state ?? IDLE;
  return (
    <>
      <span
        className={cx('settings-save-state', saved && !dirty && 'settings-save-state--saved')}
        role="status"
        data-testid="settings-save-state"
      >
        {dirty ? '• Есть несохранённые изменения' : saved ? '✓ Изменения сохранены' : ''}
      </span>
      <Button
        type="submit"
        form={SETTINGS_FORM_ID}
        disabled={!dirty || pending}
        aria-busy={pending}
      >
        {pending ? 'Сохраняю…' : 'Сохранить изменения'}
      </Button>
    </>
  );
}
