'use client';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './confirm-dialog';
import type { ButtonTone } from './ui';

export interface ConfirmRequest {
  /** Заголовок — вопрос с номером брони или названием того, что исчезнет (DESIGN.md §14) */
  title: string;
  /** Тело — сумма и последствие: что именно произойдёт и что станет нельзя */
  body?: ReactNode;
  /** Кнопка названа действием: «Отменить бронь», не «ОК» */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ButtonTone;
}

/**
 * Вопрос перед необратимым действием (DESIGN.md §8, §15; срез 7.3 плана дизайн-системы).
 *
 * Системное `window.confirm` не показывает ни суммы, ни последствия, не переводится, не оформляется
 * и на планшете выглядит чужим окном браузера. Хук держит одно окно `ConfirmDialog` на экран и
 * отдаёт `ask`, который ждёт ответ администратора: `if (!(await ask({…}))) return;` — то же место в
 * коде, что и прежняя проверка, но вопрос виден по правилам стойки.
 *
 * `dialog` ставится один раз в разметке компонента, `ask` можно звать из любого обработчика, в том
 * числе посреди уже идущей команды (выселение с долгом: сервер ответил суммой, спрашиваем и повторяем).
 */
export function useConfirm(): { ask: (request: ConfirmRequest) => Promise<boolean>; dialog: ReactNode } {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // Ответ ждёт вызывающий код: держим resolve текущего вопроса, пока администратор не нажал кнопку
  const decide = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    (next: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        // Второй вопрос поверх первого невозможен, но если он случится — прежний считается отказом
        decide.current?.(false);
        decide.current = resolve;
        setRequest(next);
      }),
    [],
  );

  const answer = useCallback((ok: boolean) => {
    const resolve = decide.current;
    decide.current = null;
    setRequest(null);
    resolve?.(ok);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ''}
      confirmLabel={request?.confirmLabel ?? ''}
      {...(request?.cancelLabel ? { cancelLabel: request.cancelLabel } : {})}
      tone={request?.tone ?? 'danger'}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    >
      {request?.body}
    </ConfirmDialog>
  );

  return { ask, dialog };
}
