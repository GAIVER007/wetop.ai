'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button, cx } from '../../components/ui';

/**
 * Сохранение «Настроек объекта» из шапки экрана (ТЗ «Настройки объекта» v2 §10, ADR-115). Форма вкладки стоит ниже
 * шапки, поэтому кнопка отправляет её атрибутом `form`, а состояние приходит через этот контекст: пока ничего не
 * изменено — кнопка выключена; после правки — «Есть несохранённые изменения»; после ответа API — «Изменения
 * сохранены» строкой, без постоянной карточки. Ошибку показывает сама форма (`Alert` над полями).
 * Кроме состояния, форма сообщает шапке текущие значения полей (`live`): по ним «Предпросмотр карточки» показывает
 * карточку ещё до сохранения (ADR-158).
 */
export const SETTINGS_FORM_ID = 'settings-form';

export interface SaveState {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
}
export type LiveValues = Record<string, string>;
const IDLE: SaveState = { dirty: false, pending: false, saved: false };
const SaveContext = createContext<{
  state: SaveState;
  report: (next: SaveState) => void;
  live: LiveValues | null;
  reportLive: (next: LiveValues | null) => void;
} | null>(null);

export function SettingsSave({ children }: { children: ReactNode }) {
  const [state, report] = useState<SaveState>(IDLE);
  const [live, reportLive] = useState<LiveValues | null>(null);
  return (
    <SaveContext.Provider value={{ state, report, live, reportLive }}>
      {children}
    </SaveContext.Provider>
  );
}

/** Форма вкладки сообщает шапке, что в ней происходит; ушла со страницы — шапка снова «ничего не изменено» */
export function useSaveReport({ dirty, pending, saved }: SaveState) {
  const report = useContext(SaveContext)?.report;
  useEffect(() => report?.({ dirty, pending, saved }), [report, dirty, pending, saved]);
  useEffect(() => () => report?.(IDLE), [report]);
}

/** Текущие значения полей формы: для карточки справа и «Предпросмотра»; `null`, пока форма не открыта */
export function useLiveReport(values: LiveValues) {
  const reportLive = useContext(SaveContext)?.reportLive;
  const key = JSON.stringify(values);
  useEffect(() => reportLive?.(JSON.parse(key) as LiveValues), [reportLive, key]);
  useEffect(() => () => reportLive?.(null), [reportLive]);
}
export const useLive = () => useContext(SaveContext)?.live ?? null;

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
